// swe_houses_armc_ex2.ts

// ---- numeric helpers (degrees) ----
const PI = Math.PI;
const RAD2DEG = 180 / PI;
const DEG2RAD = PI / 180;

// seconds of sidereal time per (solar) second for 1s step used below
// ARMCS in the C code is “sidereal seconds per solar second * 15 deg per hour / 3600”
const ARMCS = 15.0410671786691; // ≈ 360° / 23h56m04.0905s

const VERY_SMALL = 1e-9;

function sind(xDeg: number): number { return Math.sin(xDeg * DEG2RAD); }
function cosd(xDeg: number): number { return Math.cos(xDeg * DEG2RAD); }
function tand(xDeg: number): number { return Math.tan(xDeg * DEG2RAD); }
function asind(x: number): number { return Math.asin(x) * RAD2DEG; }
function sweDegNorm(xDeg: number): number {
  let v = xDeg % 360;
  if (v < 0) v += 360;
  return v;
}
// difference normalized to (-180, +180]
function sweDifdeg2n(x1Deg: number, x2Deg: number): number {
  let d = sweDegNorm(x1Deg - x2Deg);
  if (d > 180) d -= 360;
  return d;
}
// radians normalized to [0, 2π)
function sweRadNorm(xRad: number): number {
  let v = xRad % (2 * PI);
  if (v < 0) v += 2 * PI;
  return v;
}

// ---- data structures ----
export interface HousesResult {
  retc: number;                 // OK (>=0) or ERR (<0)
  cusp: number[];               // 1..12 (or 1..36 for 'G'); index 0 unused
  ascmc: number[];              // 0..9 (Asc, MC, ARMC, Vertex, Equasc, CoAsc1, CoAsc2, PolAsc, [8]=0, [9]=aux)
  cuspSpeed?: number[];         // optional; index 1..12
  ascmcSpeed?: number[];        // optional; indexes as ascmc
  serr?: string;                // error/warning
}

// Mirrors the C struct `houses` fields that `CalcH` must produce.
interface Houses {
  // flags requested by caller
  do_speed: boolean;
  do_hspeed: boolean;
  do_interpol?: boolean; // if true, caller will compute cusp speeds via interpolation

  // outputs (angles and cusps)
  cusp: number[];        // 1..36 (we’ll size this to 37)
  cusp_speed: number[];  // 1..12
  ac: number; mc: number; vertex: number; equasc: number;
  coasc1: number; coasc2: number; polasc: number;

  // angle speeds (only if do_speed)
  ac_speed: number; mc_speed: number; armc_speed: number;
  vertex_speed: number; equasc_speed: number;
  coasc1_speed: number; coasc2_speed: number; polasc_speed: number;

  // sunshine house aux
  sundec?: number;

  // error string if fallback/issue
  serr?: string;
}

// ---- engine hook (YOU must implement) ----
// Must compute the requested house system (Placidus for hsys='P').
// Return value: >=0 OK, <0 failure (caller will fall back to Porphyry cusps count).
function CalcH(
  armc: number, geolat: number, eps: number, hsys: string, h: Houses
): number {
  // TODO: implement the actual house system math here.
  // For now, throw to make the missing piece explicit.
  // You can port the ‘P’ (Placidus) branch from Swiss Ephemeris’ internal engine here.
  throw new Error("CalcH not implemented: supply Placidus/G/etc. cusp computation.");
}

// ---- main function: TypeScript port of swe_houses_armc_ex2 ----
export function swe_houses_armc_ex2(
  armcIn: number,
  geolat: number,
  eps: number,
  hsysIn: string,
  wantCuspSpeed = false,
  wantAscmcSpeed = false,
  // sunshine houses may pass ascmc[9] in; expose as optional input
  sunshineSunDeclination?: number
): HousesResult {
  const hsys = (hsysIn || 'P').toUpperCase();
  let serr = "";

  // size outputs
  const cusp = new Array<number>(hsys === 'G' ? 37 : 13).fill(0);
  const ascmc = new Array<number>(10).fill(0);
  const cusp_speed = wantCuspSpeed ? new Array<number>(13).fill(0) : undefined;
  const ascmc_speed = wantAscmcSpeed ? new Array<number>(10).fill(0) : undefined;

  let armc = sweDegNorm(armcIn);

  // init struct
  const h: Houses = {
    do_speed: Boolean(wantCuspSpeed || wantAscmcSpeed),
    do_hspeed: Boolean(wantCuspSpeed),
    do_interpol: false,
    cusp: new Array<number>(37).fill(0),
    cusp_speed: new Array<number>(13).fill(0),
    ac: 0, mc: 0, vertex: 0, equasc: 0,
    coasc1: 0, coasc2: 0, polasc: 0,
    ac_speed: 0, mc_speed: 0, armc_speed: 0,
    vertex_speed: 0, equasc_speed: 0,
    coasc1_speed: 0, coasc2_speed: 0, polasc_speed: 0,
    sundec: undefined,
    serr: ""
  };

  // Sunshine houses ('I') need the Sun declination via ascmc[9] (or cached).
  // We just pass through if provided; you can add caching like the C code if needed.
  if (hsys === 'I') {
    const sundec = sunshineSunDeclination ?? NaN;
    if (!Number.isFinite(sundec) || sundec < -24 || sundec > 24) {
      return {
        retc: -1,
        cusp, ascmc,
        cuspSpeed: cusp_speed,
        ascmcSpeed: ascmc_speed,
        serr: "House system I (Sunshine) needs valid Sun declination in ascmc[9]"
      };
    }
    h.sundec = sundec;
  }

  let retc: number;
  try {
    retc = CalcH(armc, geolat, eps, hsys, h);
  } catch (e: any) {
    retc = -1;
    serr = e?.message ?? String(e);
  }

  // index top (12 or 36)
  const ito = (hsys === 'G') ? 36 : 12;

  // on failure, we only have 12 Porphyry cusps (the C code reduces ito to 12 and copies whatever exists)
  if (retc < 0 && !serr && h.serr) serr = h.serr;

  // copy cusps
  for (let i = 1; i <= ito && i < h.cusp.length; i++) {
    cusp[i <= 12 ? i : i] = h.cusp[i];
    if (wantCuspSpeed && cusp_speed) {
      if (i <= 12) cusp_speed[i] = h.cusp_speed[i] || 0;
    }
  }

  // angles and aux
  ascmc[0] = h.ac;      // Asc
  ascmc[1] = h.mc;      // MC
  ascmc[2] = armc;      // ARMC (echo input)
  ascmc[3] = h.vertex;
  ascmc[4] = h.equasc;
  ascmc[5] = h.coasc1;
  ascmc[6] = h.coasc2;
  ascmc[7] = h.polasc;
  // [8] remains 0
  if (hsys === 'I' && typeof h.sundec === "number") {
    ascmc[9] = h.sundec;
  } else {
    ascmc[9] = 0;
  }

  // speeds for angles
  if (h.do_speed && ascmc_speed) {
    ascmc_speed[0] = h.ac_speed;
    ascmc_speed[1] = h.mc_speed;
    ascmc_speed[2] = h.armc_speed;
    ascmc_speed[3] = h.vertex_speed;
    ascmc_speed[4] = h.equasc_speed;
    ascmc_speed[5] = h.coasc1_speed;
    ascmc_speed[6] = h.coasc2_speed;
    ascmc_speed[7] = h.polasc_speed;
    // [8], [9] zero
  }

  // If the engine requested interpolation for cusp speeds, compute them here
  if (h.do_interpol && wantCuspSpeed && cusp_speed) {
    // +/− 1 second around ARM C, using sidereal rate
    let dt = 1.0 / 86400; // days
    const darmc = dt * ARMCS; // degrees of sidereal time for dt days

    const hm1: Houses = { ...h, do_speed: false, do_hspeed: false, cusp: new Array(37).fill(0), cusp_speed: new Array(13).fill(0) };
    const hp1: Houses = { ...h, do_speed: false, do_hspeed: false, cusp: new Array(37).fill(0), cusp_speed: new Array(13).fill(0) };

    if (hsys === 'I') {
      hm1.sundec = h.sundec;
      hp1.sundec = h.sundec;
    }

    let rm1 = 0, rp1 = 0;
    try { rm1 = CalcH(armc - darmc, geolat, eps, hsys, hm1); } catch { rm1 = -1; }
    try { rp1 = CalcH(armc + darmc, geolat, eps, hsys, hp1); } catch { rp1 = -1; }

    if (rp1 >= 0 && rm1 >= 0) {
      // guard big wrap on Asc (same as C logic)
      if (Math.abs(sweDifdeg2n(hp1.ac, h.ac)) > 90) {
        // use only upper interval
        for (const k of Object.keys(hp1) as (keyof Houses)[]) {
          (hp1 as any)[k] = (h as any)[k];
        }
        dt = dt / 2;
      } else if (Math.abs(sweDifdeg2n(hm1.ac, h.ac)) > 90) {
        // use only lower interval
        for (const k of Object.keys(hm1) as (keyof Houses)[]) {
          (hm1 as any)[k] = (h as any)[k];
        }
        dt = dt / 2;
      }
      for (let i = 1; i <= 12; i++) {
        const dx = sweDifdeg2n(hp1.cusp[i], hm1.cusp[i]); // in degrees over 2*dt days
        cusp_speed[i] = dx / (2 * dt);                     // deg/day
      }
    }
  }

  return {
    retc,
    cusp,
    ascmc,
    cuspSpeed: cusp_speed,
    ascmcSpeed: ascmc_speed,
    serr: serr || (retc < 0 ? "House engine failed; cusps may be Porphyry fallback." : undefined)
  };
}
