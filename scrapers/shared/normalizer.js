// Data normalizer for unified rental listing schema
// Converts data from different sources into a standardized format

const crypto = require("crypto");

/**
 * Normalize listing data from any source to unified schema
 * @param {Object} rawData - Raw data from scraper/API
 * @param {string} source - Source identifier ('kleinanzeigen', 'wg-gesucht', etc.)
 * @returns {Object} - Normalized listing data
 */
function normalizeListing(rawData, source) {
  switch (source) {
    case "kleinanzeigen":
      return normalizeKleinanzeigen(rawData);
    case "wg-gesucht":
      return normalizeWgGesucht(rawData);
    default:
      throw new Error(`Unknown source: ${source}`);
  }
}

/**
 * Normalize Kleinanzeigen data
 */
function normalizeKleinanzeigen(data) {
  // Generate unique ID if not present
  const id = data.id || generateUniqueId(data.url || data.title);

  return {
    // Core identifiers
    id: id,
    source: "kleinanzeigen",
    sourceId: id,

    // Core information
    title: cleanString(data.title || data.detailedTitle || ""),
    description: cleanString(data.description || ""),
    fullDescription: cleanString(
      data.fullDescription || data.description || ""
    ),
    price: normalizePrice(data.price || data.detailedPrice),
    currency: data.currency || "EUR",

    // Location
    location: cleanString(data.location || data.detailedLocation || ""),
    detailedLocation: cleanString(data.detailedLocation || data.location || ""),
    coordinates: extractCoordinates(data),

    // Property details
    size: extractSize(data.fullDescription || data.description || ""),
    rooms: extractRooms(data.fullDescription || data.description || ""),
    type: determinePropertyType(data.title || "", data.fullDescription || ""),

    // Media
    images: normalizeImages(data.allImages || data.images || []),

    // Metadata
    url: data.url || "",

    // Source-specific data
    sourceData: {
      originalTitle: data.title || null,
      originalDescription: data.description || null,
      seller: data.seller || {},
      additionalDetails: data.additionalDetails || {},
      createdAt: data.createdAt || null,
      postedDate: data.postedDate || null,
    },
  };
}

/**
 * Normalize WG-gesucht data
 */
function normalizeWgGesucht(data) {
  const id = data.offer_id || generateUniqueId(data.offer_title);

  return {
    // Core identifiers
    id: `wg-${id}`, // Prefix to avoid conflicts
    source: "wg-gesucht",
    sourceId: id,

    // Core information
    title: cleanString(data.offer_title || ""),
    description: cleanString(data.description || ""),
    fullDescription: cleanString(data.description || ""), // WG-gesucht usually has full description
    price: normalizePrice(data.total_costs),
    currency: "EUR",

    // Location
    location: cleanString(data.district_custom || data.town_name || ""),
    detailedLocation: cleanString(
      `${data.street || ""} ${data.district_custom || ""}`
    ),
    coordinates: {
      lat: parseFloat(data.geo_latitude) || null,
      lng: parseFloat(data.geo_longitude) || null,
    },

    // Property details
    size: parseFloat(data.property_size) || null,
    rooms: parseFloat(data.number_of_rooms) || null,
    type: determineWgGesuchtType(data.category),

    // Media
    images: normalizeWgGesuchtImages(data),

    // Metadata
    url: `https://www.wg-gesucht.de/${data.offer_id || id}`, // Construct URL

    // Source-specific data
    sourceData: {
      category: data.category || null,
      duration: data.duration || null,
      availableFrom: data.available_from_date || null,
      availableTo: data.available_to_date || null,
      flatshareDetails: {
        total: data.flatshare_inhabitants_total || null,
        males: data.flatshare_males || null,
        females: data.flatshare_females || null,
        searchedGender: data.searched_for_gender || null,
      },
      userId: data.user_id || null,
      verified: data.verified_user === "1",
    },
  };
}

/**
 * Helper functions
 */

function cleanString(str) {
  if (!str) return "";
  return str.toString().trim().replace(/\s+/g, " ");
}

function normalizePrice(price) {
  if (!price) return null;

  // Handle string prices with commas/dots
  if (typeof price === "string") {
    const cleanPrice = price.replace(/[^\d,.]/g, "").replace(",", ".");
    return parseFloat(cleanPrice) || null;
  }

  return typeof price === "number" ? price : null;
}

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];

  return images
    .filter((img) => img && typeof img === "string")
    .map((img) => (img.startsWith("http") ? img : `https:${img}`))
    .slice(0, 10); // Limit to 10 images
}

function normalizeWgGesuchtImages(data) {
  const images = [];

  // WG-gesucht has different image size formats
  if (data.thumb) images.push(`https://www.wg-gesucht.de/${data.thumb}`);
  if (data.sized) images.push(`https://www.wg-gesucht.de/${data.sized}`);
  if (data.small) images.push(`https://www.wg-gesucht.de/${data.small}`);

  return [...new Set(images)]; // Remove duplicates
}

function extractSize(text) {
  if (!text) return null;

  const sizeMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m²|qm|quadratmeter)/i);
  return sizeMatch ? parseFloat(sizeMatch[1].replace(",", ".")) : null;
}

function extractRooms(text) {
  if (!text) return null;

  const roomMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:zimmer|raum|room)/i);
  return roomMatch ? parseFloat(roomMatch[1].replace(",", ".")) : null;
}

function determinePropertyType(title, description) {
  const text = `${title} ${description}`.toLowerCase();

  if (
    text.includes("zimmer") ||
    text.includes("wg") ||
    text.includes("flatshare")
  ) {
    return "room";
  }
  if (text.includes("haus") || text.includes("house")) {
    return "house";
  }
  if (
    text.includes("büro") ||
    text.includes("office") ||
    text.includes("gewerbe")
  ) {
    return "commercial";
  }

  return "apartment"; // Default
}

function determineWgGesuchtType(category) {
  // WG-gesucht category mapping
  const typeMap = {
    0: "room", // Flatshare
    1: "apartment", // 1-room apartment
    2: "apartment", // Apartment
    3: "house", // House
  };

  return typeMap[category] || "apartment";
}

function extractCoordinates(data) {
  // Try to extract coordinates from various fields
  if (data.coordinates) {
    return data.coordinates;
  }

  if (data.geo_latitude && data.geo_longitude) {
    return {
      lat: parseFloat(data.geo_latitude),
      lng: parseFloat(data.geo_longitude),
    };
  }

  return { lat: null, lng: null };
}

function generateUniqueId(input) {
  if (!input) {
    return `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create hash from input
  const hash = crypto.createHash("md5").update(input).digest("hex");
  return hash.substr(0, 12); // Take first 12 characters
}

/**
 * Validate normalized data
 */
function validateNormalizedData(data) {
  const errors = [];

  if (!data.id) errors.push("Missing required field: id");
  if (!data.source) errors.push("Missing required field: source");
  if (!data.title) errors.push("Missing required field: title");

  if (
    data.price !== null &&
    (typeof data.price !== "number" || data.price < 0)
  ) {
    errors.push("Invalid price value");
  }

  if (data.coordinates) {
    if (
      data.coordinates.lat &&
      (data.coordinates.lat < -90 || data.coordinates.lat > 90)
    ) {
      errors.push("Invalid latitude");
    }
    if (
      data.coordinates.lng &&
      (data.coordinates.lng < -180 || data.coordinates.lng > 180)
    ) {
      errors.push("Invalid longitude");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = {
  normalizeListing,
  normalizeKleinanzeigen,
  normalizeWgGesucht,
  validateNormalizedData,
  generateUniqueId,
};
