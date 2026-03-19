// Planetary orbital elements (simplified Kepler elements for J2000.0)
export default interface PlanetaryElements {
  name: string;
  symbol: string;
  emoji: string;
  // Mean elements for J2000.0
  a: number;        // Semi-major axis (AU)
  e: number;        // Eccentricity
  I: number;        // Inclination (degrees)
  L: number;        // Mean longitude (degrees)
  longPeri: number; // Longitude of perihelion (degrees)
  longNode: number; // Longitude of ascending node (degrees)
  // Rates of change per century
  aDot: number;
  eDot: number;
  IDot: number;
  LDot: number;
  longPeriDot: number;
  longNodeDot: number;
}
