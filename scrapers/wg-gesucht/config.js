// WG-gesucht scraper configuration

module.exports = {
  // Base URL for web scraping
  BASE_URL: "https://www.wg-gesucht.de",
  SEARCH_ENDPOINT: "/wg-zimmer-in-{city}.{cityId}.0.1.0.html",
  OFFERS_ENDPOINT: "/wohnung-in-{city}.{cityId}.2.1.0.html",
  DETAIL_ENDPOINT: "/{id}.html",

  // Default search parameters
  DEFAULT_QUERY: "nachmieter",
  DEFAULT_LIMIT: 50,
  DEFAULT_CITY_ID: 8, // Berlin (most active city)

  // Search parameters
  SEARCH_PARAMS: {
    category: "0,1,2,3", // 0=WG, 1=1-room, 2=apartment, 3=house
    rent_type: "0", // 0=unlimited, 1=temporary
    sMin: 10, // minimum size
    rMax: 2000, // maximum rent
    exc: 2, // exclude certain types
    img: 1, // only with images
    fur: 0, // furnished: 0=any, 1=furnished, 2=unfurnished
    pet: 0, // pets allowed: 0=any, 1=allowed, 2=not allowed
    smo: 0, // smoking: 0=any, 1=allowed, 2=not allowed
    dFr: "", // available from date
    dTo: "", // available to date
    sin: 0, // single room in shared flat
    wgSea: 0, // WG seeking
    wgAge: 0, // age range
    wgSmo: 0, // WG smoking
    wgGen: 0, // WG gender
    wgPar: 0, // WG with children
    rmMa: 0, // room for males
    rmFe: 0, // room for females
    rmMi: 0, // mixed gender
    rmAg: 0, // age range for room
    rmSmo: 0, // smoking in room
    rmPet: 0, // pets in room
    sort: "createdate", // sort by creation date
    order: "desc", // descending order
  },

  // Rate limiting
  REQUEST_DELAY: 2000, // milliseconds between requests
  MAX_RETRIES: 3,
  TIMEOUT: 30000,

  // Data processing
  MAX_IMAGES: 10,
  MAX_DESCRIPTION_LENGTH: 5000,
  INACTIVE_THRESHOLD_DAYS: 7,

  // Headers for requests
  DEFAULT_HEADERS: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  },

  // City IDs for major German cities
  CITY_IDS: {
    BERLIN: 8,
    MUNICH: 90,
    HAMBURG: 55,
    COLOGNE: 73,
    FRANKFURT: 41,
    STUTTGART: 124,
    DUSSELDORF: 30,
    DORTMUND: 27,
    ESSEN: 37,
    LEIPZIG: 77,
    BREMEN: 17,
    DRESDEN: 28,
    HANOVER: 57,
    NUREMBERG: 96,
    DUISBURG: 29,
  },

  // Category mapping
  CATEGORIES: {
    WG_ROOM: "0", // Room in shared flat
    ONE_ROOM: "1", // 1-room apartment
    APARTMENT: "2", // Multi-room apartment
    HOUSE: "3", // House
  },

  // Rent type mapping
  RENT_TYPES: {
    UNLIMITED: "0", // Unlimited rental
    TEMPORARY: "1", // Temporary rental
  },
};
