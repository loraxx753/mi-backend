import { calculateJulianDay, getUTCFromLocal } from "../calculations";
import SwissEph from "swisseph-wasm";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PI = Math.PI, DEG = PI / 180;
const norm360 = (x: number) => { x %= 360; return x < 0 ? x + 360 : x; };
const norm180 = (x: number) => { x = ((x + 180) % 360 + 360) % 360 - 180; return x; };
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));

// --- tolerances & guards ---
const EPS_R = 1e-12;         // RA residual tolerance (deg)
const EPS_STEP = 1e-12;      // longitude step tolerance (deg)
const MAX_IT = 40;           // iteration cap
const DRA_MAX = 50;          // clamp |dRA/dλ| to avoid huge steps
const DRA_MIN = 1e-6;        // if |dRA/dλ| < DRA_MIN, use secant step
const DAMP = 0.9;            // step damping for stability
const ARCSEC_ROUND = 0.01;   // round final λ to 0.01″

function roundToArcsec(degVal: number, arcsec = ARCSEC_ROUND): number {
  const k = 3600 / arcsec;
  return Math.round(degVal * k) / k;
}

function raFromLambda(lambdaDeg: number, epsDeg: number): number {
  const λ = lambdaDeg * DEG, ε = epsDeg * DEG;
  const y = Math.sin(λ) * Math.cos(ε);
  const x = Math.cos(λ);
  return norm360(Math.atan2(y, x) / DEG);
}
function decFromLambda(lambdaDeg: number, epsDeg: number): number {
  const λ = lambdaDeg * DEG, ε = epsDeg * DEG;
  return Math.asin(Math.sin(ε) * Math.sin(λ)) / DEG;
}
// d(RA)/dλ in degrees/degree
function dRA_dLambda(lambdaDeg: number, epsDeg: number): number {
  const δ = decFromLambda(lambdaDeg, epsDeg) * DEG;
  const ε = epsDeg * DEG;
  const denom = Math.cos(δ);
  if (Math.abs(denom) < 1e-12) return Number.POSITIVE_INFINITY;
  return Math.cos(ε) / denom;
}

function semiArcs(latDeg: number, decDeg: number) {
  const φ = latDeg * DEG, δ = decDeg * DEG;
  const x = Math.tan(φ) * Math.tan(δ);                 // may exceed |1| near poles
  const AD = Math.asin(clamp(x, -1, 1)) / DEG;         // arcsin safe
  const SAD = 90 + AD;                                  // semi-diurnal arc
  const SAN = 90 - AD;                                  // semi-nocturnal arc
  // Circumpolar diagnostic (true Placidus undefined): |tanφ * tanδ| >= 1
  const circumpolar = Math.abs(x) >= 1 - 1e-15;
  return { AD, SAD, SAN, circumpolar };
}

export async function placidusIntermediateCusps(
  dateStr: string,
  timeStr: string,
  latitude: number,
  longitude: number,
) {
  const utcDate = getUTCFromLocal(dateStr, timeStr, latitude, longitude);
  const dateObj = new Date(utcDate.toISO() || '');
  const jdUtc = calculateJulianDay(dateObj);

  const result = await calculateHouses(
    dateObj.getUTCFullYear(),
    dateObj.getUTCMonth() + 1,
    dateObj.getUTCDate(),
    dateObj.getUTCHours() + dateObj.getUTCMinutes() / 60 + dateObj.getUTCSeconds() / 3600,
    latitude,
    longitude,
    'P' // Placidus
  );

  console.log({result})
}


/**
 * Compute one Placidus intermediate cusp by time-division.
 * @param armcDeg  ARMC (deg). Use MC for houses 11/12; IC (=ARMC+180) for 2/3.
 * @param latDeg   geodetic latitude (deg).
 * @param epsDeg   true obliquity (deg).
 * @param frac     1/3 or 2/3 (positive number)
 * @param sector   "upper" for 11/12 (use SAD, west of MC); "lower" for 2/3 (use SAN, east of IC)
 * @param initialGuess optional seed for λ (deg). If omitted, a meridian-offset seed is used.
 * @returns ecliptic longitude (deg); throws on circumpolar/Non-convergence.
 */
export default function placidusIntermediateCuspManual(
  armcDeg: number,
  latDeg: number,
  epsDeg: number,
  frac: number,                      // 1/3 or 2/3
  sector: "upper" | "lower",
  initialGuess?: number,
  debugLabel?: string
): number {
  // Sign in RA-space: both sectors aim for NEGATIVE meridian distance.
  // For lower sector you pass armcDeg = IC = ARMC + 180°, so “east of IC”
  // corresponds to negative MD_lower as well.
  const sign = (sector === "upper") ? +1 : -1;

  // Seed near meridian offset in RA-space (or use provided seed)
  let λ0 = norm360(
    initialGuess !== undefined ? initialGuess : (armcDeg + sign * frac * 90)
  );

  // For secant fallback we keep previous (λ, residual) pair
  let λPrev = λ0;
  let rPrev = Number.NaN;

  for (let it = 0; it < MAX_IT; it++) {

    const δ = decFromLambda(λ0, epsDeg);
    const { SAD, SAN, circumpolar } = semiArcs(latDeg, δ);
    if (circumpolar) throw new Error("Placidus undefined (circumpolar).");

    const S = (sector === "upper") ? SAD : SAN;       // choose the correct semi-arc
    const RA = raFromLambda(λ0, epsDeg);
    const RA_target = norm360(armcDeg + sign * frac * S);

    // Residual in RA-space (−180..+180]
    const r = norm180(RA - RA_target);

    // Debug: print residual for house 2 only
    if (debugLabel === 'house2') {
      console.log(`[House 2 Iter ${it}] λ0=${λ0.toFixed(8)} RA=${RA.toFixed(8)} RA_target=${RA_target.toFixed(8)} residual=${r.toFixed(8)}`);
    }

    // Convergence check (residual and step)
    if (Math.abs(r) < EPS_R) {
      const λf = norm360(λ0);
      return roundToArcsec(λf);
    }
    if (Number.isFinite(rPrev)) {
      const stepMag = Math.abs(norm180(λ0 - λPrev));
      if (stepMag < EPS_STEP && Math.abs(norm180(r - rPrev)) < EPS_R) {
        const λf = norm360(λ0);
        return roundToArcsec(λf);
      }
    }

    // Compute derivative; if unstable, use secant step
    let step: number;
    const dRA = dRA_dLambda(λ0, epsDeg);

    if (!Number.isFinite(dRA) || Math.abs(dRA) < DRA_MIN) {
      // Secant fallback: need a distinct previous point
      if (!Number.isFinite(rPrev)) {
        // create a tiny offset seed
        const λ1 = norm360(λ0 + 0.05);
        const δ1 = decFromLambda(λ1, epsDeg);
        const { SAD: SAD1, SAN: SAN1, circumpolar: cp1 } = semiArcs(latDeg, δ1);
        if (cp1) throw new Error("Placidus undefined (circumpolar).");
        const S1 = (sector === "upper") ? SAD1 : SAN1;
        const RA1 = raFromLambda(λ1, epsDeg);
        const RA_target1 = norm360(armcDeg + sign * frac * S1);
        const r1 = norm180(RA1 - RA_target1);
        // proceed with secant using (λ0, r) and (λ1, r1)
        const dr = norm180(r1 - r) || (r >= 0 ? EPS_R : -EPS_R);
        step = DAMP * norm180((r / dr) * norm180(λ1 - λ0));
        λPrev = λ0; rPrev = r;
        λ0 = norm360(λ0 - step);
        continue;
      } else {
        // Secant using (λPrev, rPrev) and (λ0, r)
        const dr = norm180(r - rPrev) || (r >= 0 ? EPS_R : -EPS_R);
        step = DAMP * norm180((r / dr) * norm180(λ0 - λPrev));
        λPrev = λ0; rPrev = r;
        λ0 = norm360(λ0 - step);
        continue;
      }
    }

    // Clamp derivative to avoid wild steps near |δ|→90°
    const dRAc = clamp(dRA, -DRA_MAX, DRA_MAX);
    step = DAMP * (r / dRAc);

    // Update with Newton-like step
    λPrev = λ0; rPrev = r;
    λ0 = norm360(λ0 - step);
  }

  throw new Error("No convergence for Placidus cusp.");
}

async function calculateHouses(year: number, month: number, day: number, hour: number, latitude: number, longitude: number, houseSystem = 'P') {
  // const swe = new SwissEph();
  // await swe.initSwissEph();
  
  // Initialize the library
  const swe = new SwissEph({
    locateFile: (filename: string) => {
      if (filename.endsWith('.data')) {
        return path.resolve(__dirname, '../../../../node_modules/swisseph-wasm/wsam/swisseph.data');
      }
      if (filename.endsWith('.wasm')) {
        return path.resolve(__dirname, '../../../../node_modules/swisseph-wasm/wsam/swisseph.wasm');
      }
      return filename;
    }
  });
  await swe.initSwissEph();

  const jd = swe.julday(year, month, day, hour, swe.SE_GREG_CAL);

  console.log('Julian Day:', jd);

  // Calculate houses
const houses = swe.houses(jd, latitude, longitude, "K");
console.log("House call:", `swe.houses(${jd}, ${latitude}, ${longitude}, "K")`);
// console.log("Ascendant:", houses.ascmc[0]);

  // // Calculate house positions for planets
  // const planets = [swe.SE_SUN, swe.SE_MOON, swe.SE_MERCURY, swe.SE_VENUS, swe.SE_MARS];
  // const planetHouses: { [key: string]: { longitude: number; house: number } } = {};

  // for (const planet of planets) {
  //   const planetPos = swe.calc_ut(jd, planet, swe.SEFLG_SWIEPH);
  //   const housePos = swe.house_pos(
  //     swe.sidtime(jd) * 15, // ARMC
  //     latitude,
  //     23.44, // obliquity
  //     houseSystem,
  //     planetPos[0],
  //     planetPos[1]
  //   );

  //   planetHouses[swe.get_planet_name(planet)] = {
  //     longitude: planetPos[0],
  //     house: Math.floor(housePos)
  //   };
  // }

  // swe.close();

  return {
    houses: houses,
    // planetHouses: planetHouses
  };
}
