// Import swisseph (Swiss Ephemeris)

import swisseph from 'swisseph';
import colors from 'ansi-colors';
import * as positions from '../lib/constants/SwissEphemerisObjectIds.js';
import { getZodiacFromLongitude } from './calculate/astrology.js';

// Set Swiss Ephemeris data path
// swisseph.swe_set_ephe_path('./node_modules/swisseph/ephe');

export function getSwissEphPlanetPositions(jd: number) {
  const results: Record<string, any> = {};
  
  // Get main planets
  Object.entries(positions.planets).forEach(([name, id]) => {
    if (name === 'earth') return; // Skip Earth
    
    const res = swisseph.swe_calc_ut(
      jd,
      id,
      swisseph.SEFLG_SWIEPH | swisseph.SEFLG_SPEED
    );
    
    if ('longitude' in res) {
      results[name] = {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        longitude: res.longitude,
        latitude: res.latitude,
        speed: res.longitudeSpeed,
      };
    }
  });

  return results;
}

export async function getSwissEphHouses(
    jd: number,
    latitude: number,
    longitude: number
): Promise<any> {
  return swisseph.swe_houses(
      jd,
      latitude,
      longitude,
      "P",
      (res: any) => res
  );
}

export async function getPlacidusCusps(
    jd: number,
    latitude: number,
    longitude: number
): Promise<number[]> {
    // Calculate with Swiss Ephemeris
    let sweCusps;
    try {
      sweCusps = await getSwissEphHouses(jd, latitude, longitude);
    } catch (err) {
      console.error(colors.red('Swiss Ephemeris error:'), err);
      throw err;
    }
    return sweCusps;
}

export function getJulianDay(date: Date): number {
  // swisseph expects Julian Day in UT
  // date: JS Date object (UTC)
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 + date.getUTCMilliseconds() / 3600000;
  return swisseph.swe_julday(year, month, day, hour, swisseph.SE_GREG_CAL);
}

export function getSwissEphPositions(
    jd: number,
    latitude: number,
    longitude: number
) {
  const results: any = {};
  Object.values(positions).forEach((id) => {
    console.log(id)
    // swisseph.swe_calc_ut(jd, id, swisseph.SEFLG_SWIEPH, (err, res) => {
    //   if (!err) {
    //     console.log(`Body ${id}: longitude = ${res.longitude}`);
    //   }
    // });
  });
}