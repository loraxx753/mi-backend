import tzLookup from "tz-lookup";
import { DateTime } from "luxon";
import { sanitizeDeg, degToRad } from "../utils.js";

const PI = Math.PI;
const DEG = PI / 180;
const radToDeg = (rad: number): number => rad * 180 / PI;

// Calculate obliquity of the ecliptic (Earth's axial tilt)
export function calculateObliquityOfEcliptic(T: number): number {
  // IAU 1980 formula for obliquity
  const eps0 = 23.439291111; // Mean obliquity at J2000.0 in degrees
  const dEps = -46.8150 * T - 0.00059 * T * T + 0.001813 * T * T * T;
  return eps0 + dEps / 3600; // Convert arcseconds to degrees
}


// Format a float orb value to { degree, minutes, seconds, float }
export function formatOrb(orb: number) {
  const degree = Math.floor(Math.abs(orb));
  const minutesFloat = (Math.abs(orb) - degree) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.round((minutesFloat - minutes) * 60);
  return { degree, minutes, seconds, float: orb };
}

export function getUTCFromLocal(dateStr: string, timeStr: string, latitude: number, longitude: number) {
  const timezone = tzLookup(latitude, longitude);
  const dt = DateTime.fromISO(`${dateStr}T${timeStr}`, { zone: timezone });
  return dt.toUTC();
}

// Julian Day Number calculation (fundamental to astronomical calculations)
export function calculateJulianDay(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // JavaScript months are 0-indexed  
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds();

  // Convert time to fraction of day
  const dayFraction = (hour + minute / 60 + second / 3600) / 24;
  
  // Standard Julian Day calculation (corrected)
  // Based on the fact that August 18, 1984 00:00 UTC = JD 2445921.5
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + 
              Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  
  // JDN gives us the Julian Day Number at noon, so we add the day fraction
  return jdn + dayFraction - 0.5;
}


// Calculate Moon's phase (0 = New Moon, 0.5 = Full Moon)
export function calculateMoonPhase(moonLongitude: number, sunLongitude: number): {
  phase: number;
  phaseName: string;
  phaseDescription: string;
  illumination: number;
} {
  // Calculate the elongation (angular separation)
  let elongation = moonLongitude - sunLongitude;
  if (elongation < 0) elongation += 360;
  if (elongation > 180) elongation -= 360;
  
  // Phase as a fraction (0 = New, 0.5 = Full)
  const phase = (1 - Math.cos(elongation * Math.PI / 180)) / 2;
  
  // Illumination percentage
  const illumination = phase * 100;
  
  // Determine phase name
  let phaseName: string;
  let phaseDescription: string;
  
  const absElongation = Math.abs(elongation);
  
  if (absElongation < 7.5) {
    phaseName = "New Moon";
    phaseDescription = "Moon is between Earth and Sun, invisible from Earth";
  } else if (absElongation < 82.5) {
    phaseName = elongation > 0 ? "Waxing Crescent" : "Waning Crescent";
    phaseDescription = elongation > 0 ? "Moon is growing larger each night" : "Moon is shrinking each night";
  } else if (absElongation < 97.5) {
    phaseName = elongation > 0 ? "First Quarter" : "Last Quarter";
    phaseDescription = elongation > 0 ? "Right half of Moon is illuminated" : "Left half of Moon is illuminated";
  } else if (absElongation < 172.5) {
    phaseName = elongation > 0 ? "Waxing Gibbous" : "Waning Gibbous";
    phaseDescription = elongation > 0 ? "Moon is almost full, still growing" : "Moon is past full, shrinking";
  } else {
    phaseName = "Full Moon";
    phaseDescription = "Earth is between Moon and Sun, Moon is fully illuminated";
  }
  
  return {
    phase,
    phaseName,
    phaseDescription,
    illumination
  };
}


// Detailed step-by-step calculation breakdown
export interface CalculationStep {
  id: string;
  title: string;
  description: string;
  formula: string;
  calculation?: string;
  result?: number | string;
  unit?: string;
  subSteps?: CalculationStep[];
}

/**
 * Calculate the Local Sidereal Time (LST) in decimal hours for a given date, time, and longitude.
 * @param dateStr - Date string in 'YYYY-MM-DD' format
 * @param timeStr - Time string in 'HH:mm' or 'HH:mm:ss' format (24h)
 * @param longitude - Longitude in degrees (East positive, West negative)
 * @returns LST in decimal hours (0-24)
 */
export function getLocalSiderealTime(utcDateTime: DateTime, longitude: number): number {
  // Parse date and time
  const year = utcDateTime.year;
  const month = utcDateTime.month;
  const day = utcDateTime.day;
  const hour = utcDateTime.hour;
  const minute = utcDateTime.minute;
  const second = utcDateTime.second;

  // Julian Day calculation (at 0h UT)
  const Y = month > 2 ? year : year - 1;
  const M = month > 2 ? month : month + 12;
  const D = day + (hour + minute / 60 + Number(second) / 3_600) / 24;
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const JD = Math.floor(365.25 * (Y + 4_716)) + Math.floor(30.6001 * (M + 1)) + D + B - 1_524.5;

  // Julian centuries since J2000.0
  const T = (JD - 2_451_545.0) / 36_525.0;

  // --- Calculate Nutation in Longitude (Delta Psi) ---
  // You'll need to define meanObliquityDeg() if you don't have it yet.
  const Omega = (125.04452 - 1934.136261 * T + 0.0020708 * T * T + T * T * T / 450000) % 360;
  const L1 = (280.4665 + 36000.7698 * T) % 360; // Sun mean longitude (used in previous snippet)
  const L2 = (218.3165 + 481267.8813 * T) % 360; // Moon mean longitude (used in previous snippet)
  // Largest term for Delta Psi (in arcseconds)
  const deltaPsiArcsec = -17.20 * Math.sin(Omega * DEG) - 1.32 * Math.sin(2 * L1 * DEG) - 0.23 * Math.sin(2 * L2 * DEG) + 0.21 * Math.sin(2 * Omega * DEG);
  const deltaPsiDeg = deltaPsiArcsec / 3600.0; // Convert to degrees

  // Greenwich Mean Sidereal Time (GMST) in seconds
  let GMST = 280.46061837 + 360.98564736629 * (JD - 2_451_545) + 0.000387933 * T * T - (T * T * T) / 38_710_000;
  GMST = ((GMST % 360) + 360) % 360; // Normalize GMST to 0-360

  // --- Crucial Step: Add Delta Psi to get GAST ---
  const GAST = sanitizeDeg(GMST + deltaPsiDeg);
  const GAST_hours = GAST / 15;

  // Local Sidereal Time (LST) in hours
  // Use GAST_hours instead of GMST_hours
  let LST = GAST_hours + longitude / 15;
  LST = ((LST % 24) + 24) % 24; // Normalize to 0-24
  return LST;
}



/**
 * Calculates the declination (D) given ecliptic longitude (L) and obliquity (O).
 * Formula: sin(D) = sin(O) * sin(L)
 */
export function calculateDeclination(L: number, O: number): number {
  const LRad = degToRad(L);
  const ORad = degToRad(O);
  // Using Math.asin provides the result in radians, convert back to degrees
  return radToDeg(Math.asin(Math.sin(ORad) * Math.sin(LRad)));
}

/**
 * Calculates the Ecliptic Longitude (L) given Right Ascension (RA) and obliquity (O).
 * Uses atan2 for robust quadrant handling.
 */
export function calculateLongitude(RA: number, O: number): number {
    const RSRad = degToRad(RA);
    const ORad = degToRad(O);

    // Using atan2 to correctly determine the angle in all four quadrants
    // The formula for atan2(y, x) here is based on spherical trigonometry
    const y = Math.sin(RSRad);
    const x = Math.cos(RSRad) * Math.cos(ORad);
    
    const longitudeRad = Math.atan2(y, x);

    return sanitizeDeg(radToDeg(longitudeRad));
}

export function calculateLongitudeFromOA(OA: number, latitude: number, obliquity: number): number {
    const OARad = degToRad(OA);
    const latRad = degToRad(latitude);
    const oblRad = degToRad(obliquity);

    // Using atan2(y, x) for correct quadrant handling:
    const y = Math.sin(OARad);
    const x = Math.cos(OARad) * Math.cos(oblRad) - Math.tan(latRad) * Math.sin(oblRad);

    const longitudeRad = Math.atan2(y, x);

    // Return the result normalized to 0-360 degrees
    return sanitizeDeg(radToDeg(longitudeRad));
}
