// Listings API routes - unified data from all sources
const express = require("express");
const { databaseService } = require("../../scrapers/shared/database");

const router = express.Router();

/**
 * GET /api/listings - Get all listings with filters
 */
router.get("/", async (req, res) => {
  try {
    console.log("📋 GET /api/listings called with filters:", req.query);

    // Parse query parameters
    const filters = {
      source: req.query.source, // 'kleinanzeigen', 'wg-gesucht', or undefined for all
      isActive: req.query.active !== "false", // Default to true
      minPrice: req.query.minPrice ? parseInt(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? parseInt(req.query.maxPrice) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      type: req.query.type, // 'room', 'apartment', 'house', 'commercial'
      location: req.query.location,
    };

    // Remove undefined values
    Object.keys(filters).forEach((key) => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });

    console.log("🔍 Applied filters:", filters);

    // Get listings from database
    const listings = await databaseService.getListings(filters);

    // Additional client-side filtering (for fields not indexed in DB)
    let filteredListings = listings;

    if (filters.type) {
      filteredListings = filteredListings.filter(
        (listing) => listing.type === filters.type
      );
    }

    if (filters.location) {
      const locationFilter = filters.location.toLowerCase();
      filteredListings = filteredListings.filter(
        (listing) =>
          listing.location?.toLowerCase().includes(locationFilter) ||
          listing.detailedLocation?.toLowerCase().includes(locationFilter)
      );
    }

    // Group by source for statistics
    const sourceStats = filteredListings.reduce((acc, listing) => {
      acc[listing.source] = (acc[listing.source] || 0) + 1;
      return acc;
    }, {});

    console.log(`✅ Returning ${filteredListings.length} listings`);
    console.log("📊 Sources:", sourceStats);

    res.json({
      success: true,
      listings: filteredListings,
      count: filteredListings.length,
      filters: filters,
      statistics: {
        totalListings: filteredListings.length,
        sourceBreakdown: sourceStats,
        lastUpdated:
          filteredListings.length > 0
            ? Math.max(
                ...filteredListings.map(
                  (l) => l.lastSeen?.toMillis?.() || l.lastSeen || 0
                )
              )
            : null,
      },
    });
  } catch (error) {
    console.error("❌ Failed to get listings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve listings",
      message: error.message,
    });
  }
});

/**
 * GET /api/listings/:id - Get specific listing by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const listingId = req.params.id;
    console.log(`🔍 GET /api/listings/${listingId}`);

    // Get specific listing from database
    const listings = await databaseService.getListings({
      limit: 1000, // We'll filter by ID client-side
    });

    const listing = listings.find((l) => l.id === listingId);

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: "Listing not found",
        id: listingId,
      });
    }

    console.log(`✅ Found listing: ${listing.title} from ${listing.source}`);

    res.json({
      success: true,
      listing: listing,
    });
  } catch (error) {
    console.error(`❌ Failed to get listing ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve listing",
      message: error.message,
      id: req.params.id,
    });
  }
});

/**
 * GET /api/listings/source/:source - Get listings from specific source
 */
router.get("/source/:source", async (req, res) => {
  try {
    const source = req.params.source;
    console.log(`🔍 GET /api/listings/source/${source}`);

    if (!["kleinanzeigen", "wg-gesucht"].includes(source)) {
      return res.status(400).json({
        success: false,
        error: "Invalid source",
        validSources: ["kleinanzeigen", "wg-gesucht"],
      });
    }

    // Get listings from specific source
    const filters = {
      source: source,
      isActive: req.query.active !== "false",
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
    };

    const listings = await databaseService.getListings(filters);

    console.log(`✅ Found ${listings.length} listings from ${source}`);

    res.json({
      success: true,
      listings: listings,
      count: listings.length,
      source: source,
    });
  } catch (error) {
    console.error(
      `❌ Failed to get listings from ${req.params.source}:`,
      error
    );
    res.status(500).json({
      success: false,
      error: "Failed to retrieve listings from source",
      message: error.message,
      source: req.params.source,
    });
  }
});

/**
 * GET /api/listings/stats - Get aggregated statistics
 */
router.get("/stats", async (req, res) => {
  try {
    console.log("📊 GET /api/listings/stats");

    // Get all active listings
    const listings = await databaseService.getListings({ isActive: true });

    // Calculate statistics
    const stats = {
      totalListings: listings.length,
      sources: {},
      types: {},
      priceRanges: {
        "0-500": 0,
        "500-1000": 0,
        "1000-1500": 0,
        "1500+": 0,
        unknown: 0,
      },
      averagePrice: 0,
      medianPrice: 0,
      lastUpdated:
        listings.length > 0
          ? Math.max(
              ...listings.map(
                (l) => l.lastSeen?.toMillis?.() || l.lastSeen || 0
              )
            )
          : null,
    };

    // Process each listing
    const prices = [];

    listings.forEach((listing) => {
      // Source breakdown
      stats.sources[listing.source] = (stats.sources[listing.source] || 0) + 1;

      // Type breakdown
      stats.types[listing.type] = (stats.types[listing.type] || 0) + 1;

      // Price analysis
      if (listing.price && listing.price > 0) {
        prices.push(listing.price);

        if (listing.price <= 500) {
          stats.priceRanges["0-500"]++;
        } else if (listing.price <= 1000) {
          stats.priceRanges["500-1000"]++;
        } else if (listing.price <= 1500) {
          stats.priceRanges["1000-1500"]++;
        } else {
          stats.priceRanges["1500+"]++;
        }
      } else {
        stats.priceRanges.unknown++;
      }
    });

    // Calculate price statistics
    if (prices.length > 0) {
      stats.averagePrice = Math.round(
        prices.reduce((a, b) => a + b, 0) / prices.length
      );

      const sortedPrices = prices.sort((a, b) => a - b);
      const middle = Math.floor(sortedPrices.length / 2);
      stats.medianPrice =
        sortedPrices.length % 2 === 0
          ? Math.round((sortedPrices[middle - 1] + sortedPrices[middle]) / 2)
          : sortedPrices[middle];
    }

    console.log("✅ Generated statistics:", stats);

    res.json({
      success: true,
      statistics: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Failed to get statistics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate statistics",
      message: error.message,
    });
  }
});

module.exports = router;
