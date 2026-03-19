
import swisseph from 'swisseph';
import * as SE from '../lib/constants/SwissEphemerisObjectIds.js';
import { convertToZodiac } from '../utils.js';

// Utility: flatten all object values into a single array
function flattenObjectValues(obj: Record<string, number>): number[] {
  return Object.values(obj);
}

// Compose all IDs you want to calculate
const defaultObjectIds = [
  ...flattenObjectValues(SE.planets),
  ...flattenObjectValues(SE.nodes),
  ...flattenObjectValues(SE.asteroids),
  ...flattenObjectValues(SE.uranianPlanets),
  // ...flattenObjectValues(SE.fictitiousBodies), // Uncomment if you want these too
];

const flags = swisseph.SEFLG_SWIEPH | swisseph.SEFLG_SPEED;

/**
 * Calculate a comprehensive birth chart using Swiss Ephemeris
 * @param {number} jd - Julian Day
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} houseSystem - e.g. 'P' for Placidus
 * @param {Array<number>} [objectIds] - Optional: override default objects
 * @returns {Promise<{summary: string, details: object}>}
 */
export async function getComprehensiveBirthChart(
  jd: number,
  latitude: number,
  longitude: number,
  houseSystem: string = 'P',
  objectIds: number[] = defaultObjectIds
): Promise<{ summary: string; details: object }> {
  // Map of ID to name for fallback
  const idToName: Record<number, string> = {
    ...Object.fromEntries(Object.entries(SE.planets).map(([k, v]) => [v, k])),
    ...Object.fromEntries(Object.entries(SE.nodes).map(([k, v]) => [v, k])),
    ...Object.fromEntries(Object.entries(SE.asteroids).map(([k, v]) => [v, k])),
    ...Object.fromEntries(Object.entries(SE.uranianPlanets).map(([k, v]) => [v, k])),
    // ...Object.fromEntries(Object.entries(SE.fictitiousBodies).map(([k, v]) => [v, k])),
  };

  // Calculate positions for all requested objects
  const planetPositions = await Promise.all(
    objectIds.map((pid) =>
      new Promise((resolve, reject) => {
        swisseph.swe_calc(
          jd,
          pid,
          flags,
          (result: any) => {
            // Swiss Ephemeris returns result as an object, no 'error' property
            // If result is undefined or missing longitude, treat as error
            if (!result || typeof result.longitude !== 'number') {
              return reject(new Error(`Calculation failed for object ID ${pid}`));
            }
            resolve({
              id: pid,
              name: idToName[pid] || `Object_${pid}`,
              longitude: result.longitude,
              latitude: result.latitude,
              speed: result.longitudeSpeed ?? result.speed ?? null,
            });
          }
        );
      })
    )
  );

  // Calculate house cusps and angles
  const houses = await new Promise((resolve, reject) => {
    swisseph.swe_houses(
      jd,
      latitude,
      longitude,
      houseSystem,
      (result: any) => {
        // No 'error' property; check for expected keys
        if (!result || !result.house) {
          return reject(new Error('House calculation failed'));
        }
        resolve(result);
      }
    );
  });

  // Optionally, aspects can be calculated here

  return {
    summary: 'Comprehensive astrological reading',
    details: {
      planets: planetPositions,
      houses,
      // aspects: [...], // implement aspect logic if needed
    },
  };
}