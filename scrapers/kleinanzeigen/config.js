// Kleinanzeigen scraper configuration

module.exports = {
  // Default search parameters
  DEFAULT_QUERY: "nachmieter",
  DEFAULT_LIMIT: 50,
  DEFAULT_LOCATION: "",

  // Scraping behavior
  FETCH_DETAILS_BY_DEFAULT: true,
  DETAIL_FETCH_DELAY: 1500, // milliseconds between detail requests
  RETRY_ATTEMPTS: 3,
  REQUEST_TIMEOUT: 30000,

  // URLs and selectors
  BASE_URL: "https://www.kleinanzeigen.de",
  SEARCH_URL: "https://www.kleinanzeigen.de/s-anzeige:angebote",

  // Data cleanup settings
  INACTIVE_THRESHOLD_DAYS: 7, // Mark listings as inactive after this many days
  MAX_IMAGES: 10,
  MAX_DESCRIPTION_LENGTH: 5000,

  // Categories mapping
  CATEGORIES: {
    FLATSHARES: "203",
    ONE_ROOM: "199",
    APARTMENTS: "203",
    HOUSES: "208",
    COMMERCIAL: "277",
  },

  // Browser configuration for Puppeteer
  BROWSER_CONFIG: {
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  },

  // User agent for requests
  USER_AGENT:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};
