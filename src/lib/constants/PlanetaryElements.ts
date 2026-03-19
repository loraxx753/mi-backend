import PlanetaryElements from "../types/PlanetaryElements.js";

export const PLANETARY_ELEMENTS: Record<string, PlanetaryElements> = {
  earth: {
    name: 'Earth',
    symbol: '🜨',
    emoji: '🌍',
    a: 1.00000261,      e: 0.01671123,      I: -0.00001531,
    L: 100.46457166,    longPeri: 102.93768193,   longNode: 0.0,
    aDot: 0.00000562,   eDot: -0.00004392,  IDot: -0.01294668,
    LDot: 35999.37244981, longPeriDot: 0.32327364, longNodeDot: 0.0
  },
  mercury: {
    name: 'Mercury',
    symbol: '☿',
    emoji: '☿️',
    a: 0.38709927,      e: 0.20563593,      I: 7.00497902,
    L: 252.25032350,    longPeri: 77.45779628,    longNode: 48.33076593,
    aDot: 0.00000037,   eDot: 0.00001906,   IDot: -0.00594749,
    LDot: 149472.67411175, longPeriDot: 0.16047689, longNodeDot: -0.12534081
  },
  venus: {
    name: 'Venus',
    symbol: '♀',
    emoji: '♀️',
    a: 0.72333566,      e: 0.00677672,      I: 3.39467605,
    L: 181.97909950,    longPeri: 131.60246718,   longNode: 76.67984255,
    aDot: 0.00000390,   eDot: -0.00004107,  IDot: -0.00078890,
    LDot: 58517.81538729, longPeriDot: 0.00268329, longNodeDot: -0.27769418
  },
  mars: {
    name: 'Mars',
    symbol: '♂',
    emoji: '♂️',
    a: 1.52371034,      e: 0.09339410,      I: 1.84969142,
    L: -4.55343205,     longPeri: -23.94362959,   longNode: 49.55953891,
    aDot: 0.00001847,   eDot: 0.00007882,   IDot: -0.00813131,
    LDot: 19140.30268499, longPeriDot: 0.44441088, longNodeDot: -0.29257343
  },
  jupiter: {
    name: 'Jupiter',
    symbol: '♃',
    emoji: '♃️',
    a: 5.20288700,      e: 0.04838624,      I: 1.30439695,
    L: 34.39644051,     longPeri: 14.72847983,    longNode: 100.47390909,
    aDot: -0.00011607,  eDot: -0.00013253,  IDot: -0.00183714,
    LDot: 3034.74612775, longPeriDot: 0.21252668, longNodeDot: 0.20469106
  },
  saturn: {
    name: 'Saturn',
    symbol: '♄',
    emoji: '♄️',
    // VSOP87/Swiss Ephemeris J2000.0 values
    a: 9.554909595,      // AU
    e: 0.05554814,
    I: 2.49424102,       // degrees
    L: 50.07744430,      // degrees
    longPeri: 92.86136063, // degrees
    longNode: 113.66552412, // degrees
    aDot: -0.0000021389,   // AU/century
    eDot: -0.000344664,    // /century
    IDot: -0.00451969,     // deg/century
    LDot: 1221.551589,     // deg/century
    longPeriDot: 0.54179478, // deg/century
    longNodeDot: -0.256662   // deg/century
  }
};

export const bodySymbols: Record<string, string> = {
  Sun: '☉',
  Moon: '☽',
  Mercury: '☿',
  Venus: '♀',
  Mars: '♂',
  Jupiter: '♃',
  Saturn: '♄',
  Uranus: '♅',
  Neptune: '♆',
  Pluto: '♇',
  Ceres: '⚳',
  Pallas: '⚴',
  Juno: '⚵',
  Vesta: '⚶',
  Chiron: '⚷',
  NorthNode: '☊', // True Node (ascending)
  SouthNode: '☋', // Descending Node
  PartOfFortune: '⊗', // Pars Fortunae
  Ascendant: '↑', // No official, up arrow
  Descendant: '↓', // No official, down arrow
  Midheaven: '⟰', // No official, double up arrow
  ImumCoeli: '⟱', // No official, double down arrow
};

export const signEmojis: Record<string, string> = {
  Aries: '♈️', Taurus: '♉️', Gemini: '♊️', Cancer: '♋️', Leo: '♌️', Virgo: '♍️',
  Libra: '♎️', Scorpio: '♏️', Sagittarius: '♐️', Capricorn: '♑️', Aquarius: '♒️', Pisces: '♓️',
};
