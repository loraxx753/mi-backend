import { degToRad, radToDeg, sanitizeDeg, trueObliquityDeg } from '../../utils.js';
import { PLANETARY_ELEMENTS } from '../../lib/constants/PlanetaryElements.js';
import PlanetaryElements from '../../lib/types/PlanetaryElements.js';
import { getAscendantAndMC, getZodiacFromLongitude } from './astrology.js';
import placidusIntermediateCusp, { placidusIntermediateCusps } from './placidusIntermediateCusp.js';

import placidusIntermediateCuspManual, { placidusIntermediateCusps as placidusIntermediateCuspsDev } from './placidusIntermediateCusp.js';

let angles: { ascendant: number; midheaven: number; descendant: number; imumCoeli: number, obliquity: number, lstDegrees: number };

// Calculate single planet position
export function calculatePlanetPosition(
  planetKey: keyof typeof PLANETARY_ELEMENTS
): {
  julianDay: number;
  centuriesFromJ2000: number;
  elements: PlanetaryElements;
  meanAnomaly: number;
  eccentricAnomaly: number;
  trueAnomaly: number;
  heliocentricLongitude: number;
  geocentricLongitude: number;
  zodiacPosition: { sign: string; degree: number; minutes: number; seconds: number };
} {
  // Deprecated: All planetary position calculations are now sourced from HORIZONS. This function is retained for reference only.
  return {
    julianDay: 0,
    centuriesFromJ2000: 0,
    elements: PLANETARY_ELEMENTS[planetKey],
    meanAnomaly: 0,
    eccentricAnomaly: 0,
    trueAnomaly: 0,
    heliocentricLongitude: 0,
    geocentricLongitude: 0,
    zodiacPosition: { sign: '', degree: 0, minutes: 0, seconds: 0 }
  };
}

// House system calculations
interface HouseCusps {
  [key: number]: number; // House number -> Longitude in degrees
}

interface HouseSystemResult {
  ascendant: number;
  midheaven: number;
  descendant: number;
  imumCoeli: number;
  cusps: HouseCusps;
  system: string;
}


// function calculateAngularCusps() {
//     const { ascendant, midheaven, descendant, imumCoeli } = angles;
  
//   // Placeholder for angular house calculations if needed
// }
function calculateIntermediateCusp(ramcDeg: number, latitude: number, obliquity: number, fraction: number): number {
  const latRad = degToRad(latitude);
  const oblRad = degToRad(obliquity);

  // Initial guess: RAMC + fraction * 90 (as before)
  let guess = sanitizeDeg(ramcDeg + fraction * 90);
  let lastDiff = 9999;
  for (let i = 0; i < 20; i++) {
    const LRad = degToRad(guess);
    // Declination of guessed longitude
    const sinDec = Math.sin(oblRad) * Math.sin(LRad);
    const dec = Math.asin(sinDec);
    // Semi-diurnal arc S for this declination
    const tanLat = Math.tan(latRad);
    const tanDec = Math.tan(dec);
    let S = 0;
    if (Math.abs(tanLat * tanDec) <= 1) {
      S = Math.acos(-tanLat * tanDec); // in radians
    } else {
      S = 0; // circumpolar case
    }
    S = radToDeg(S); // in degrees
    // Hour angle for this cusp (always positive)
    const H = Math.abs(fraction) * S;
    // Right ascension of the cusp: add or subtract H depending on sign of fraction
    let raCusp;
    if (fraction > 0) {
      raCusp = sanitizeDeg(ramcDeg - H);
    } else {
      raCusp = sanitizeDeg(ramcDeg + H);
    }
    // Find the longitude whose RA matches raCusp
    const ra = calculateRA(guess, obliquity);
    let diff = sanitizeDeg(raCusp - ra);
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    if (Math.abs(diff) < 1e-6 || Math.abs(diff - lastDiff) < 1e-8) break;
    guess = sanitizeDeg(guess + diff);
    lastDiff = diff;
  }
  return guess;
}

export function calculateRA(L: number, O: number): number {
  const LRad = degToRad(L);
  const ORad = degToRad(O);
  return sanitizeDeg(radToDeg(Math.atan2(Math.cos(ORad) * Math.sin(LRad), Math.cos(LRad))));
}



// Placidus House System
export async function calculatePlacidusHouses(
  dateStr: string, timeStr: string, latitude: number, longitude: number
): Promise<HouseCusps> {
  const cusps: HouseCusps = {};

  const { ascendant, midheaven, descendant, imumCoeli } = angles;


  // Angular houses (exact)
  cusps[1] = ascendant;
  cusps[4] = imumCoeli; // IC (Imum Coeli)
  cusps[7] = descendant;
  cusps[10] = midheaven; // MC (Medium Coeli)

  // Calculate intermediate cusps using Placidus method
  // latRad and oblRad removed (no longer used)

  const { lstDegrees, obliquity } = angles;


    const result = await placidusIntermediateCusps(
      dateStr,
      timeStr,
      latitude,
      longitude,
    );

  // Always use true obliquity for intermediate cusps
  cusps[11] = placidusIntermediateCuspManual(lstDegrees, latitude, obliquity, 1/3, "upper");
  cusps[12] = placidusIntermediateCuspManual(lstDegrees, latitude, obliquity, 2/3, "upper");
  const ic = sanitizeDeg(lstDegrees + 180);
  cusps[2] = placidusIntermediateCuspManual(ic, latitude, obliquity, 2/3, "lower", undefined, 'house2');
  cusps[3] = placidusIntermediateCuspManual(ic, latitude, obliquity, 1/3, "lower");
  
  // Houses 5, 6, 8, 9 (opposite cusps)
  cusps[5] = (cusps[11] + 180) % 360;
  cusps[6] = (cusps[12] + 180) % 360;
  cusps[8] = (cusps[2] + 180) % 360;
  cusps[9] = (cusps[3] + 180) % 360;
  
  // Print debug comparison to Swiss Ephemeris
  return cusps;
}

// Equal House System
export function calculateEqualHouses(ascendant: number): HouseCusps {
  const cusps: HouseCusps = {};
  
  for (let house = 1; house <= 12; house++) {
    cusps[house] = (ascendant + (house - 1) * 30) % 360;
  }
  
  return cusps;
}

// Whole Sign House System
export function calculateWholeSignHouses(ascendant: number): HouseCusps {
  const cusps: HouseCusps = {};
  const ascendantSign = Math.floor(ascendant / 30) * 30; // Start of sign containing ascendant
  
  for (let house = 1; house <= 12; house++) {
    cusps[house] = (ascendantSign + (house - 1) * 30) % 360;
  }
  
  return cusps;
}

// Koch House System (simplified)
export function calculateKochHouses(
  ascendant: number,
  midheaven: number,
  // latitude and obliquity parameters removed (no longer used)
): HouseCusps {
  const cusps: HouseCusps = {};
  
  // Angular houses
  cusps[1] = ascendant;
  cusps[4] = (midheaven + 180) % 360;
  cusps[7] = (ascendant + 180) % 360;
  cusps[10] = midheaven;
  
  // Koch method uses a different calculation for intermediate cusps
  // Simplified version - in practice this requires complex spherical trigonometry
  const quadrantSize = ((midheaven - ascendant + 360) % 360) / 3;
  
  cusps[2] = (ascendant + quadrantSize) % 360;
  cusps[3] = (ascendant + 2 * quadrantSize) % 360;
  cusps[11] = (midheaven + quadrantSize) % 360;
  cusps[12] = (midheaven + 2 * quadrantSize) % 360;
  
  // Opposite cusps
  cusps[5] = (cusps[11] + 180) % 360;
  cusps[6] = (cusps[12] + 180) % 360;
  cusps[8] = (cusps[2] + 180) % 360;
  cusps[9] = (cusps[3] + 180) % 360;
  
  return cusps;
}

// Main house calculation function
export async function calculateHouseSystem({
  date,
  time,
  latitude,
  longitude,
  system = 'placidus'
}: {
  date: string;
  time: string;
  latitude: number;
  longitude: number;
  system?: string;
}): Promise<HouseSystemResult> {
  
  let cusps: HouseCusps;

  const { ascendant, midheaven, descendant, imumCoeli, obliquity, lstDegrees } = getAscendantAndMC(date, time, latitude, longitude);
  angles = { ascendant, midheaven, descendant, imumCoeli, obliquity, lstDegrees };
  switch (system.toLowerCase()) {
    case 'equal':
      cusps = calculateEqualHouses(ascendant);
      break;
    case 'whole-sign':
    case 'whole sign':
      cusps = calculateWholeSignHouses(ascendant);
      break;
    case 'koch':
      cusps = calculateKochHouses(ascendant, midheaven);
      break;
    case 'placidus':
    default:
      cusps = await calculatePlacidusHouses(date, time, latitude, longitude);
      break;
  }
  
  return {
    ascendant,
    midheaven,
    descendant: (ascendant + 180) % 360,
    imumCoeli: (midheaven + 180) % 360,
    cusps,
    system
  };
}

// --- Swiss Ephemeris reference values for Kevin Baugh Test Case ---
const SWISS_EPHEMERIS_CUSPS: { [key: number]: { sign: string; deg: number; min: number; sec: number } } = {
  1: { sign: 'Virgo', deg: 9, min: 52, sec: 4 },
  2: { sign: 'Libra', deg: 8, min: 23, sec: 20 },
  3: { sign: 'Scorpio', deg: 7, min: 52, sec: 25 },
  4: { sign: 'Sagittarius', deg: 8, min: 53, sec: 36 },
  5: { sign: 'Capricorn', deg: 10, min: 26, sec: 18 },
  6: { sign: 'Aquarius', deg: 10, min: 53, sec: 46 },
  7: { sign: 'Pisces', deg: 9, min: 52, sec: 4 },
  8: { sign: 'Aries', deg: 8, min: 23, sec: 20 },
  9: { sign: 'Taurus', deg: 7, min: 52, sec: 25 },
 10: { sign: 'Gemini', deg: 8, min: 53, sec: 36 },
 11: { sign: 'Cancer', deg: 10, min: 26, sec: 18 },
 12: { sign: 'Leo', deg: 10, min: 53, sec: 46 },
};

function dmsToDeg(d: number, m: number, s: number): number {
  return d + m / 60 + s / 3600;
}

function printCuspComparison(myCusps: { [key: number]: number }) {
  for (let house = 1; house <= 12; house++) {
    const my = myCusps[house];
    const sw = SWISS_EPHEMERIS_CUSPS[house];
    if (!my || !sw) continue;
    // Convert both to degrees for difference
    const myDeg = my;
    const swDeg = dmsToDeg(sw.deg, sw.min, sw.sec);
    const diff = Math.abs(((myDeg - swDeg + 540) % 360) - 180); // minimal angle diff
    console.log(
      `House ${house}: Yours ${myDeg.toFixed(6)}° | SwissEph ${sw.sign} ${sw.deg}°${sw.min}'${sw.sec}" (${swDeg.toFixed(6)}°) | Δ=${diff.toFixed(2)}°`
    );
  }
}

// Example usage (call after your cusps are calculated):
// printCuspComparison(cusps);
