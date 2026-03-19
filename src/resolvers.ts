
import { getHorizonsBirthChartPositions } from './services/horizonsService.js';
import { geocodeLocation } from './services/geocoding.js';
import { reverseGeocode } from './services/geocoding.js';
import { getSwissEphHouses} from './services/swissephService.js';
// import { printCuspComparison } from './services/calculate/houses.js';
import swisseph from 'swisseph';
import tzLookup from 'tz-lookup';
import { DateTime } from 'luxon';
import { convertToZodiac, getZodiacFromLongitude } from './services/calculate/astrology.js';
import { getSwissEphPlanetPositions } from './services/swissephService.js';

// Type interfaces
interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  confidence: number;
}

interface ReverseGeocodeResult {
  city: string;
  state: string;
  country: string;
}

interface ZodiacSign {
  name: string;
  element: string;
  modality: string;
  rulingPlanet: string;
}

interface CuspDegrees {
  whole: number;
  minutes: number;
  seconds: number;
  decimal: number;
}

interface HouseCusp {
  decimal: number;
  degrees: CuspDegrees;
}

interface House {
  houseNumber: number;
  sign: string;
  cusp: HouseCusp;
}

interface Location {
  city: string;
  country: string;
  state?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

interface BirthChart {
  houses: House[];
  signs: (ZodiacSign | undefined)[];
}

interface Reading {
  id: string;
  uid: string;
  name: string;
  date: string;
  time: string;
  location: Location;
  birthChart: BirthChart;
}

export const resolvers = {
  Query: {
    async latLongFromLocation(_: any, { city, country, region }: { city: string; country: string; region?: string }) {
      // Use geocodeLocation service, mapping region to state for compatibility
      try {
        const result = await geocodeLocation({ city, country, state: region });
        return {
          latitude: result.latitude,
          longitude: result.longitude,
          formattedAddress: result.formattedAddress,
          confidence: result.confidence,
        };
      } catch (error) {
        // Return a GraphQL-friendly error
        throw new Error(error instanceof Error ? error.message : 'Geocoding failed');
      }
    },
    async planetaryPositions(_: any, { date, time, latitude, longitude, city, region, country }: { date: string; time: string; latitude?: number; longitude?: number; city?: string; region?: string; country?: string; }) {
      if(!latitude || !longitude) {
        // If lat/long not provided, attempt to geocode from city/country/region
        if(city && country) {
          const geoResult = await geocodeLocation({ city, country, state: region });
          latitude = geoResult.latitude;
          longitude = geoResult.longitude;
        } else {
          throw new Error('Either latitude/longitude or city/country must be provided');
        }
      }
      return await getHorizonsBirthChartPositions(date, time, latitude, longitude);
    },
    async locationFromLatLong(_: any, { latitude, longitude }: { latitude: number; longitude: number }) {
      try {
        const result = await reverseGeocode(latitude, longitude);
        return {
          city: result.city,
          state: result.state,
          country: result.country,
        };
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Reverse geocoding failed');
      }
    },
    async housePositions(_: any, { date, time, latitude, longitude }: { date: string; time: string; latitude: number; longitude: number; }) {
      const timezone = tzLookup(latitude, longitude);
      const localDateTime = DateTime.fromFormat(`${date} ${time}`, 'yyyy-MM-dd HH:mm', { zone: timezone });
      const utcDateTime = localDateTime.toUTC();
      const jd = swisseph.swe_julday(
        utcDateTime.year,
        utcDateTime.month,
        utcDateTime.day,
        utcDateTime.hour + utcDateTime.minute / 60 + utcDateTime.second / 3600,
        swisseph.SE_GREG_CAL
      );
      return await getSwissEphHouses(jd, latitude, longitude);
    },
async reading(_: any, { uid, name, date, time, latitude, longitude, city, region, country }: { uid: string; name: string; date: string; time: string; latitude?: number; longitude?: number; city?: string; region?: string; country?: string; }) {
  if(!latitude && !longitude && city && country) {
    const result = await geocodeLocation({ city, country, state: region });
    latitude = result.latitude;
    longitude = result.longitude;
  }
  else if(latitude && longitude && !city && !country) {
    const result = await reverseGeocode(latitude, longitude);
    city = result.city;
    region = result.state;
    country = result.country;
  }
  
  const timezone = tzLookup(latitude, longitude);
  const localDateTime = DateTime.fromFormat(`${date} ${time}`, 'yyyy-MM-dd HH:mm', { zone: timezone });
  const utcDateTime = localDateTime.toUTC();
  const jd = swisseph.swe_julday(
    utcDateTime.year,
    utcDateTime.month,
    utcDateTime.day,
    utcDateTime.hour + utcDateTime.minute / 60 + utcDateTime.second / 3600,
    swisseph.SE_GREG_CAL
  );

  console.log('Reading requested with:', { uid, name, date, time, latitude, longitude, city, region, country });
  console.log('Computed timezone:', timezone);
  console.log('Local DateTime:', localDateTime.toISO());
  console.log('UTC DateTime:', utcDateTime.toISO());
  console.log('Julian Day:', jd);

  const housesResult = await resolvers.Query.housePositions({}, { date, time, latitude: latitude!, longitude: longitude! });
  
  // Format houses with signs and degree details
  const houses = housesResult.house.map((cusp: number, index: number) => {
    const zodiac = getZodiacFromLongitude(cusp);
    return {
      houseNumber: index + 1,
      sign: zodiac.sign,
      cusp: {
        decimal: cusp,
        degrees: {
          whole: zodiac.degree,
          minutes: zodiac.minutes,
          seconds: zodiac.seconds,
          decimal: cusp
        }
      }
    };
  });

  const planets = getSwissEphPlanetPositions(jd);

// Format planets to match CelestialBodyPosition schema
const celestialBodyPositions = Object.values(planets).map((planet: any) => {
  const zodiac = getZodiacFromLongitude(planet.longitude);
  return {
    name: planet.name,
    sign: zodiac.sign,
    degree: zodiac.degree,
    minutes: zodiac.minutes,
    seconds: zodiac.seconds,
    decimalLongitude: planet.longitude,
    ra: 0, // Swiss Ephemeris gives ecliptic coords, not equatorial
    dec: 0,
    longitude: planet.longitude,
    latitude: planet.latitude,
    dateStr: utcDateTime.toISO(),
    northNodeLongitude: null,
    southNodeLongitude: null
  };
});

  // Zodiac signs data
  const signData = [
    { name: 'Aries', element: 'Fire', modality: 'Cardinal', rulingPlanet: 'Mars' },
    { name: 'Taurus', element: 'Earth', modality: 'Fixed', rulingPlanet: 'Venus' },
    { name: 'Gemini', element: 'Air', modality: 'Mutable', rulingPlanet: 'Mercury' },
    { name: 'Cancer', element: 'Water', modality: 'Cardinal', rulingPlanet: 'Moon' },
    { name: 'Leo', element: 'Fire', modality: 'Fixed', rulingPlanet: 'Sun' },
    { name: 'Virgo', element: 'Earth', modality: 'Mutable', rulingPlanet: 'Mercury' },
    { name: 'Libra', element: 'Air', modality: 'Cardinal', rulingPlanet: 'Venus' },
    { name: 'Scorpio', element: 'Water', modality: 'Fixed', rulingPlanet: 'Mars' },
    { name: 'Sagittarius', element: 'Fire', modality: 'Mutable', rulingPlanet: 'Jupiter' },
    { name: 'Capricorn', element: 'Earth', modality: 'Cardinal', rulingPlanet: 'Saturn' },
    { name: 'Aquarius', element: 'Air', modality: 'Fixed', rulingPlanet: 'Saturn' },
    { name: 'Pisces', element: 'Water', modality: 'Mutable', rulingPlanet: 'Jupiter' },
  ];

  return {
    id: `${uid}-${Date.now()}`,
    uid,
    name,
    date,
    time,
    location: {
      city,
      country,
      state: region,
      latitude,
      longitude,
      timezone
    },
    birthChart: {
      houses,
      signs: signData,
      celestialBodyPositions,
    }
  };
}  },
  Mutation: {
    // async createClientChart(_: any, input: IClientChart) {
    //   const chart = new ClientCharts(input);
    //   await chart.save();
    //   return chart;
    // },
    // async deleteClientChart(_: any, { id }: { id: string }) {
    //   return await ClientCharts.findByIdAndDelete(id);
    // },
  },
};
