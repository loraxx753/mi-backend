import { degToRad, radToDeg, sanitizeDeg, jdTTfromUTC, estimateDeltaT, trueObliquityDeg } from "../../utils.js";
import { getLocalSiderealTime, getUTCFromLocal, calculateJulianDay, calculateLongitude } from "../calculations.js";

export function getZodiacFromLongitude(longitude: number) {
  const names = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  let d = longitude % 360;
  if (d < 0) d += 360;
  const signIndex = Math.floor(d / 30);
  const sign = names[signIndex];
  const degree = Math.floor(d % 30);
  const minutes = Math.floor((d % 1) * 60);
  const seconds = Math.round((((d % 1) * 60) % 1) * 60);
  return { degree, minutes, seconds, sign };
}

export function getAscendantAndMC(dateStr: string, timeStr: string, latitude: number, longitude: number) {
  const utcDate = getUTCFromLocal(dateStr, timeStr, latitude, longitude);
  const dateObj = new Date(utcDate.toISO() || '');
  const jdUtc = calculateJulianDay(dateObj);
  // For modern dates, ΔT ≈ 69s (can be parameterized for historical accuracy)
  const deltaT = estimateDeltaT(dateObj); // seconds
  const jdTT = jdTTfromUTC(jdUtc, deltaT);
  const obliquity = trueObliquityDeg(jdTT); // True obliquity (mean + nutation)

  // Sidereal time and angles
  const lst = getLocalSiderealTime(utcDate, longitude);
  const lstDegrees = lst * 15;
  const ramc = lstDegrees; // RAMC is LST in degrees
  const ic = sanitizeDeg(lstDegrees + 180);

  // Debug output for sidereal time, RAMC, IC, and obliquity
  console.log('DEBUG JD UTC:', jdUtc);
  console.log('DEBUG JD TT:', jdTT);
  console.log('DEBUG ΔT (sec):', deltaT);
  console.log('DEBUG LST (hours):', lst);
  console.log('DEBUG LST (deg):', lstDegrees);
  console.log('DEBUG RAMC (deg):', ramc);
  console.log('DEBUG IC (deg):', ic);
  console.log('DEBUG Obliquity (deg):', obliquity);

  // Calculate Ascendant (rising sign)
  const lstRad = degToRad(lstDegrees);
  const latRad = degToRad(latitude);
  const oblRad = degToRad(obliquity);

  const y = -Math.cos(lstRad);
  const x = Math.sin(lstRad) * Math.cos(oblRad) + Math.tan(latRad) * Math.sin(oblRad);

  let ascendant = radToDeg(Math.atan2(y, x));
  ascendant += 180; // correct quadrant
  ascendant = sanitizeDeg(ascendant); // normalize

  const midheaven = calculateLongitude(lstDegrees, obliquity);
  const descendant = (ascendant + 180) % 360;
  const imumCoeli = (midheaven + 180) % 360;

  console.log('Inputs for MC:', lstDegrees, obliquity); 
  console.log('MC Result:', midheaven);

  return { ascendant, midheaven, descendant, imumCoeli, obliquity, lstDegrees };
}


export const convertToZodiac = (degrees: number) => {
    const signs = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
    ];
    const d = ((degrees % 360) + 360) % 360;
    const signIndex = Math.floor(d / 30);
    const sign = signs[signIndex];
    const degree = Math.floor(d % 30);
    const minutes = Math.floor((d % 1) * 60);
    const seconds = Math.round((((d % 1) * 60) - minutes) * 60);
    return { sign, degree, minutes, seconds };
}
// Utility: Convert decimal degrees to DMS with N/S/E/W
export function toDMS(value: number, type: 'lat' | 'long'): string {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60);
  let dir = '';
  if (type === 'lat') dir = value >= 0 ? 'N' : 'S';
  if (type === 'long') dir = value >= 0 ? 'E' : 'W';
  return `${deg}°${min}'${sec}" ${dir}`;
}
