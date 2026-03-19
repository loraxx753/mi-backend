/**
 * Geocoding service for converting addresses to coordinates
 * Uses multiple fallback APIs to ensure reliability
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  confidence?: number;
}

export interface GeocodeRequest {
  city: string;
  country: string;
  region?: string;
}

class GecodingError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'GecodingError';
  }
}

/**
 * Primary geocoding service using Nominatim (OpenStreetMap)
 * Free, no API key required, good for basic geocoding
 */
export const geocodeWithNominatim = async (request: GeocodeRequest): Promise<GeocodeResult> => {
  const { city, country, region } = request;
  
  // Construct query string
  const addressParts = [city, region, country].filter(Boolean);
  const query = encodeURIComponent(addressParts.join(', '));
  
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&addressdetails=1`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AstrologyApp/1.0', // Nominatim requires a user agent
      },
    });
    
    if (!response.ok) {
      throw new GecodingError(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      throw new GecodingError('No results found for this location');
    }
    
    const result = data[0];
    
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      formattedAddress: result.display_name,
      confidence: result.importance || 0.5,
    };
  } catch (error) {
    if (error instanceof GecodingError) {
      throw error;
    }
    throw new GecodingError(`Geocoding request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Fallback geocoding service using OpenCage
 * Requires API key but more reliable for some locations
 * Sign up at: https://opencagedata.com/
 */
export const geocodeWithOpenCage = async (request: GeocodeRequest, apiKey: string): Promise<GeocodeResult> => {
  const { city, country, region } = request;

  const addressParts = [city, region, country].filter(Boolean);
  const query = encodeURIComponent(addressParts.join(', '));
  
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${query}&key=${apiKey}&limit=1`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new GecodingError(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      throw new GecodingError('No results found for this location');
    }
    
    const result = data.results[0];
    
    return {
      latitude: result.geometry.lat,
      longitude: result.geometry.lng,
      formattedAddress: result.formatted,
      confidence: result.confidence || 0.5,
    };
  } catch (error) {
    if (error instanceof GecodingError) {
      throw error;
    }
    throw new GecodingError(`OpenCage geocoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Main geocoding function with fallback logic
 */
export const geocodeLocation = async (request: GeocodeRequest): Promise<GeocodeResult> => {
  // Validate input
  if (!request.city?.trim() || !request.country?.trim()) {
    throw new GecodingError('City and country are required for geocoding');
  }
  
  try {
    // Try Nominatim first (free, no API key needed)
    const result = await geocodeWithNominatim(request);
    
    // Validate coordinates are reasonable
    if (Math.abs(result.latitude) > 90 || Math.abs(result.longitude) > 180) {
      throw new GecodingError('Invalid coordinates returned from geocoding service');
    }
    
    return result;
  } catch (error) {
    console.warn('Nominatim geocoding failed:', error);
    
    // Here you could add fallback to other services if you have API keys
    // For now, re-throw the error
    throw error;
  }
};

/**
 * Debounced geocoding function to avoid too many API calls
 */
export const createDebouncedGeocoder = (delay: number = 1000) => {
  let timeoutId: NodeJS.Timeout;
  
  return (request: GeocodeRequest): Promise<GeocodeResult> => {
    return new Promise((resolve, reject) => {
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(async () => {
        try {
          const result = await geocodeLocation(request);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
};

/**
 * Reverse geocoding: convert coordinates back to address
 */
export interface ReverseGeocodeResult {
  city?: string;
  state?: string;
  country?: string;
  formattedAddress?: string;
}

export const reverseGeocode = async (latitude: number, longitude: number): Promise<ReverseGeocodeResult> => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AstrologyApp/1.0',
      },
    });
    
    if (!response.ok) {
      throw new GecodingError(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.address) {
      throw new GecodingError('No address found for these coordinates');
    }
    
    const address = data.address;
    
    return {
      city: address.city || address.town || address.village || address.hamlet,
      state: address.state || address.province || address.region,
      country: address.country,
      formattedAddress: data.display_name,
    };
  } catch (error) {
    if (error instanceof GecodingError) {
      throw error;
    }
    throw new GecodingError(`Reverse geocoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Create a debounced reverse geocoder
 */
export const createDebouncedReverseGeocoder = (delay: number = 1000) => {
  let timeoutId: NodeJS.Timeout;
  
  return (latitude: number, longitude: number): Promise<ReverseGeocodeResult> => {
    return new Promise((resolve, reject) => {
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(async () => {
        try {
          const result = await reverseGeocode(latitude, longitude);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
};

/**
 * Get timezone from coordinates using a simple heuristic
 * For production, consider using a proper timezone API like:
 * - Google Time Zone API
 * - TimeZoneDB API
 * - GeoNames API
 */
export const getTimezoneFromCoordinates = (latitude: number, longitude: number): string => {
  // This is a simplified timezone lookup based on longitude
  // For accurate results, use a proper timezone API
  
  // Common timezone mappings based on approximate longitude ranges
  if (longitude >= -125 && longitude <= -114) return 'America/Los_Angeles'; // Pacific
  if (longitude >= -114 && longitude <= -105) return 'America/Denver';      // Mountain
  if (longitude >= -105 && longitude <= -90) return 'America/Chicago';      // Central
  if (longitude >= -90 && longitude <= -65) return 'America/New_York';      // Eastern
  
  if (longitude >= -10 && longitude <= 30) return 'Europe/London';          // UK/Western Europe
  if (longitude >= 30 && longitude <= 45) return 'Europe/Paris';            // Central Europe
  
  if (longitude >= 120 && longitude <= 150) return 'Asia/Tokyo';            // Japan/Eastern Asia
  if (longitude >= 150 && longitude <= 180) return 'Australia/Sydney';      // Eastern Australia
  
  // Default to UTC if we can't determine
  return 'UTC';
};

/**
 * Interface for popular location suggestions
 */
export interface PopularLocation {
  city: string;
  country: string;
  region?: string;
  lat: number;
  lng: number;
}

/**
 * Common location suggestions for quick selection
 */
export const popularLocations: PopularLocation[] = [
  { city: 'New York', country: 'United States', region: 'New York', lat: 40.7128, lng: -74.0060 },
  { city: 'Los Angeles', country: 'United States', region: 'California', lat: 34.0522, lng: -118.2437 },
  { city: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { city: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
  { city: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093 },
  { city: 'Toronto', country: 'Canada', region: 'Ontario', lat: 43.6532, lng: -79.3832 },
  { city: 'Berlin', country: 'Germany', lat: 52.5200, lng: 13.4050 },
];