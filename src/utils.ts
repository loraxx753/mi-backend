const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;



/** Normalize angle to [0, 360) degrees */
export function norm360(deg: number): number {
  return (deg % 360 + 360) % 360;
}

/** Julian Day from a JavaScript Date interpreted as UTC */
export function jdUTC(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1; // 1..12
  const d =
    date.getUTCDate() +
    (date.getUTCHours() +
      (date.getUTCMinutes() +
        (date.getUTCSeconds() + date.getUTCMilliseconds() / 1000) / 60) /
        60) /
      24;

  let Y = y;
  let M = m;
  if (m <= 2) {
    Y = y - 1;
    M = m + 12;
  }

  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 25);
  // Gregorian reform: valid for dates >= 1582-10-15 (Horizons output is mixed-calendar aware)
  const JD =
    Math.floor(365.25 * (Y + 4716)) +
    Math.floor(30.6001 * (M + 1)) +
    d +
    B -
    1524.5;

  return JD;
}

/**
 * Mean obliquity of the ecliptic (IAU 2006, arcseconds polynomial).
 * Input: JD(TT). Accuracy: ~0.1″ over several centuries.
 */
export function meanObliquityDeg(jdTT: number): number {
  const T = (jdTT - 2451545.0) / 36525.0; // Julian centuries TT from J2000.0
  const epsArcsec =
    84381.406 -
    46.836769 * T -
    0.0001831 * T * T +
    0.00200340 * T * T * T -
    5.76e-7 * T * T * T * T -
    4.34e-8 * T * T * T * T * T;
  return epsArcsec / 3600.0;
}

/**
 * Convert apparent RA/Dec (deg; equator/equinox of date) to ecliptic-of-date lon/lat (deg).
 * - raDeg, decDeg: apparent RA/Dec in **degrees** from Horizons (use the a-app pair).
 * - jdTT: Julian Day (TT). You can approximate jdTT ≈ jdUTC + ΔT/86400.
 * - opts.epsDeg: if provided, uses this obliquity (deg). Otherwise uses mean obliquity of date.
 *
 * Returns: { lon: [0,360), lat: [-90,90] } in **degrees**.
 */
export function raDecToEclipticOfDate(
  raDeg: number,
  decDeg: number,
  jdTT: number,
  opts: { epsDeg?: number } = {}
): { lon: number; lat: number } {
  const eps = (opts.epsDeg ?? meanObliquityDeg(jdTT)) * D2R;

  const α = raDeg * D2R;
  const δ = decDeg * D2R;

  // Equatorial unit vector
  const xeq = Math.cos(δ) * Math.cos(α);
  const yeq = Math.cos(δ) * Math.sin(α);
  const zeq = Math.sin(δ);

  // Rotate +ε about x-axis: equatorial -> ecliptic-of-date
  const xecl = xeq;
  const yecl = Math.cos(eps) * yeq + Math.sin(eps) * zeq;
  const zecl = -Math.sin(eps) * yeq + Math.cos(eps) * zeq;

  let lon = Math.atan2(yecl, xecl) * R2D;
  if (lon < 0) lon += 360;
  const lat = Math.asin(zecl) * R2D;

  return { lon: norm360(lon), lat };
}

/** Convenience: jdTT from jdUTC and ΔT (seconds). */
export function jdTTfromUTC(jdUtc: number, deltaT_sec: number): number {
  return jdUtc + deltaT_sec / 86400.0;
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

/**
 * True obliquity of the ecliptic (mean obliquity + nutation in obliquity, Meeus Ch. 22)
 * Input: JD(TT). Returns degrees.
 */
export function trueObliquityDeg(jdTT: number): number {
  // Meeus, Astronomical Algorithms, Ch. 22
  const T = (jdTT - 2451545.0) / 36525.0;
  // Mean obliquity (arcsec)
  const eps0 = meanObliquityDeg(jdTT);
  // Fundamental arguments (all in degrees)
  const D2R = Math.PI / 180;
  const L1 = (280.4665 + 36000.7698 * T) % 360; // Sun mean longitude
  const L2 = (218.3165 + 481267.8813 * T) % 360; // Moon mean longitude
  const Omega = (125.04452 - 1934.136261 * T + 0.0020708 * T * T + T * T * T / 450000) % 360; // Longitude of ascending node of Moon
  // Nutation in obliquity (arcsec)
  // Only the largest term (Meeus Eq. 22.3); for more accuracy, sum more terms
  const deltaEps = 9.20 * Math.cos(D2R * Omega) + 0.57 * Math.cos(D2R * (2 * L1)) + 0.10 * Math.cos(D2R * (2 * L2)) - 0.09 * Math.cos(D2R * (2 * Omega));
  // Convert arcsec to degrees
  return eps0 + deltaEps / 3600.0;
}

export const degToRad = (deg: number) => deg * Math.PI / 180;
export const radToDeg = (rad: number) => rad * 180 / Math.PI;
export const sanitizeDeg = (deg: number) => ((deg % 360) + 360) % 360;


/**
 * Estimate ΔT (delta T) in seconds for any date using best-known polynomials.
 * @param date JS Date object (UTC assumed)
 * @returns ΔT in seconds
 * Covers: -500 to 2150+ (Meeus, Espenak & Meeus, Morrison & Stephenson, NASA)
 */
export function estimateDeltaT(date: Date): number {
  // Convert to decimal year (down to minute)
  const year = date.getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 1, 0, 0, 0, 0);
  const endOfYear = Date.UTC(year + 1, 0, 1, 0, 0, 0, 0);
  const msInYear = endOfYear - startOfYear;
  const msSinceStart = date.getTime() - startOfYear;
  const decimalYear = year + msSinceStart / msInYear;

  // ΔT formulas by era (see NASA, Espenak & Meeus, Morrison & Stephenson, etc.)
  // All results in seconds
  if (decimalYear < -500) {
    // Before -500: crude linear extrapolation
    const u = (decimalYear - 1820) / 100;
    return -20 + 32 * u * u;
  } else if (decimalYear < 500) {
    // -500 to 500 (Morrison & Stephenson, quadratic fit)
    const u = decimalYear / 100;
    return 10583.6 - 1014.41 * u + 33.78311 * u * u - 5.952053 * u * u * u
      - 0.1798452 * u * u * u * u + 0.022174192 * u * u * u * u * u
      + 0.0090316521 * u * u * u * u * u * u;
  } else if (decimalYear < 1600) {
    // 500 to 1600 (Morrison & Stephenson, cubic fit)
    const u = (decimalYear - 1000) / 100;
    return 1574.2 - 556.01 * u + 71.23472 * u * u + 0.319781 * u * u * u
      - 0.8503463 * u * u * u * u - 0.005050998 * u * u * u * u * u
      + 0.0083572073 * u * u * u * u * u * u;
  } else if (decimalYear < 1700) {
    // 1600 to 1700 (linear fit)
    const t = decimalYear - 1600;
    return 120 + 0.9808 * t - 0.01532 * t * t + t * t * t / 7129;
  } else if (decimalYear < 1800) {
    // 1700 to 1800 (quadratic fit)
    const t = decimalYear - 1700;
    return 8.83 + 0.1603 * t - 0.0059285 * t * t + 0.00013336 * t * t * t - t * t * t * t / 1174000;
  } else if (decimalYear < 1860) {
    // 1800 to 1860 (cubic fit)
    const t = decimalYear - 1800;
    return 13.72 - 0.332447 * t + 0.0068612 * t * t + 0.0041116 * t * t * t - 0.00037436 * t * t * t * t + 0.0000121272 * t * t * t * t * t - 0.0000001699 * t * t * t * t * t * t + 0.000000000875 * t * t * t * t * t * t * t;
  } else if (decimalYear < 1900) {
    // 1860 to 1900 (quadratic fit)
    const t = decimalYear - 1860;
    return 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * t * t * t - 0.0004473624 * t * t * t * t + t * t * t * t * t / 233174;
  } else if (decimalYear < 1920) {
    // 1900 to 1920 (quadratic fit)
    const t = decimalYear - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t * t * t - 0.000197 * t * t * t * t;
  } else if (decimalYear < 1941) {
    // 1920 to 1941 (linear fit)
    const t = decimalYear - 1920;
    return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t * t * t;
  } else if (decimalYear < 1961) {
    // 1941 to 1961 (linear fit)
    const t = decimalYear - 1950;
    return 29.07 + 0.407 * t - t * t / 233 + t * t * t / 2547;
  } else if (decimalYear < 1986) {
    // 1961 to 1986 (polynomial fit)
    const t = decimalYear - 1975;
    return 45.45 + 1.067 * t - t * t / 260 - t * t * t / 718;
  } else if (decimalYear < 2005) {
    // 1986 to 2005 (polynomial fit)
    const t = decimalYear - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t * t * t + 0.000651814 * t * t * t * t + 0.00002373599 * t * t * t * t * t;
  } else if (decimalYear < 2050) {
    // 2005 to 2050 (Meeus, quadratic fit)
    const t = decimalYear - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  } else if (decimalYear < 2150) {
    // 2050 to 2150 (Meeus, linear extrapolation)
    return -20 + 32 * ((decimalYear - 1820) / 100) * ((decimalYear - 1820) / 100) - 0.5628 * (2150 - decimalYear);
  } else {
    // After 2150 (Meeus, quadratic extrapolation)
    const u = (decimalYear - 1820) / 100;
    return -20 + 32 * u * u;
  }
}

export const bodyTypes = {
    planets: ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"],
    asteroids: ['Ceres', 'Pallas', 'Juno', 'Vesta'],
    nodes: ['North Node', 'South Node'],
    other: ['Chiron', 'Lilith'],
};

export function resolveAspectGrammar(aspect: string): string {
    switch(aspect) {
        case 'conjunction':
            return 'conjunct';
        case 'opposition':
            return 'opposite';
        default:
            return aspect;
    }
}