// Search API routes - real-time search across all sources
const express = require("express");
const {
  kleinanzeigenScraper,
} = require("../../scrapers/kleinanzeigen/scraper");
const WgGesuchtScraper = require("../../scrapers/wg-gesucht/scraper");

// Create WG-gesucht scraper instance
const wgGesuchtScraper = new WgGesuchtScraper();

const router = express.Router();

/**
 * GET /api/search - Search across all sources in real-time
 */
router.get("/", async (req, res) => {
  try {
    const query = req.query.q || req.query.query || "nachmieter";
    const limit = parseInt(req.query.limit) || 20;
    const source = req.query.source; // Optional: filter by specific source

    console.log(
      `🔍 Search request: "${query}" (limit: ${limit}, source: ${
        source || "all"
      })`
    );

    const results = {
      query: query,
      limit: limit,
      sources: {},
      items: [],
      totalCount: 0,
      timestamp: new Date().toISOString(),
    };

    // Search promises for parallel execution
    const searchPromises = [];

    // Search Kleinanzeigen (if no source filter or specifically requested)
    if (!source || source === "kleinanzeigen") {
      searchPromises.push(
        kleinanzeigenScraper
          .search({ query, limit })
          .then((items) => {
            results.sources.kleinanzeigen = {
              count: items.length,
              status: "success",
            };
            return items;
          })
          .catch((error) => {
            console.error("❌ Kleinanzeigen search failed:", error.message);
            results.sources.kleinanzeigen = {
              count: 0,
              status: "error",
              error: error.message,
            };
            return [];
          })
      );
    }

    // Search WG-gesucht (if no source filter or specifically requested)
    // Note: WG-gesucht doesn't support keyword searches, so we get general listings
    if (!source || source === "wg-gesucht") {
      searchPromises.push(
        wgGesuchtScraper
          .search({ limit }) // No query parameter - WG-gesucht doesn't support keywords
          .then((items) => {
            results.sources["wg-gesucht"] = {
              count: items.length,
              status: "success",
              note: "General listings - keyword search not supported",
            };
            return items;
          })
          .catch((error) => {
            console.error("❌ WG-gesucht search failed:", error.message);
            results.sources["wg-gesucht"] = {
              count: 0,
              status: "error",
              error: error.message,
            };
            return [];
          })
      );
    }

    // Execute all searches in parallel
    console.log(`⚡ Executing ${searchPromises.length} parallel searches...`);
    const searchResults = await Promise.all(searchPromises);

    // Combine and sort results
    const allItems = searchResults.flat();

    // Sort by price (ascending) with null prices at the end
    const sortedItems = allItems.sort((a, b) => {
      if (a.price === null && b.price === null) return 0;
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      return a.price - b.price;
    });

    // Apply final limit across all sources
    results.items = sortedItems.slice(0, limit);
    results.totalCount = results.items.length;

    // Calculate statistics
    const sourceBreakdown = results.items.reduce((acc, item) => {
      acc[item.source] = (acc[item.source] || 0) + 1;
      return acc;
    }, {});

    console.log(
      `✅ Search completed: ${results.totalCount} items from ${
        Object.keys(results.sources).length
      } sources`
    );
    console.log("📊 Source breakdown:", sourceBreakdown);

    res.json({
      success: true,
      ...results,
      statistics: {
        sourceBreakdown,
        averagePrice: calculateAveragePrice(results.items),
        priceRange: calculatePriceRange(results.items),
      },
    });
  } catch (error) {
    console.error("❌ Search failed:", error);
    res.status(500).json({
      success: false,
      error: "Search failed",
      message: error.message,
      query: req.query.q || req.query.query,
    });
  }
});

/**
 * GET /api/search/sources - Get available search sources and their status
 */
router.get("/sources", async (req, res) => {
  try {
    console.log("📋 Getting search sources status");

    const sources = {
      kleinanzeigen: await kleinanzeigenScraper.getHealth(),
      "wg-gesucht": await wgGesuchtScraper.getHealth(),
    };

    const availableSources = Object.keys(sources).filter(
      (source) => sources[source].status === "healthy"
    );

    res.json({
      success: true,
      sources: sources,
      availableCount: availableSources.length,
      totalCount: Object.keys(sources).length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Failed to get sources status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get sources status",
      message: error.message,
    });
  }
});

/**
 * POST /api/search/save - Save search results to database
 */
router.post("/save", async (req, res) => {
  try {
    const { query, source, limit } = req.body;

    // Query is only required for Kleinanzeigen, not for WG-gesucht
    if (!query && source !== "wg-gesucht") {
      return res.status(400).json({
        success: false,
        error: "Query parameter is required (except for wg-gesucht)",
      });
    }

    console.log(
      `💾 Saving search results for: "${query || "general listings"}" (${
        source || "all sources"
      })`
    );

    let stats;

    // Execute search and save to database
    if (source === "kleinanzeigen" || !source) {
      stats = await kleinanzeigenScraper.scrape({
        query: query,
        limit: limit || 50,
        fetchDetails: true,
      });
    } else if (source === "wg-gesucht") {
      // WG-gesucht doesn't support keyword searches
      stats = await wgGesuchtScraper.scrape({
        limit: limit || 50,
        fetchDetails: true,
      });
    }

    res.json({
      success: true,
      message: "Search results saved to database",
      stats: stats,
    });
  } catch (error) {
    console.error("❌ Failed to save search results:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save search results",
      message: error.message,
    });
  }
});

/**
 * Helper functions
 */
function calculateAveragePrice(items) {
  const prices = items
    .filter((item) => item.price && item.price > 0)
    .map((item) => item.price);
  if (prices.length === 0) return null;
  return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
}

function calculatePriceRange(items) {
  const prices = items
    .filter((item) => item.price && item.price > 0)
    .map((item) => item.price);
  if (prices.length === 0) return { min: null, max: null };
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

module.exports = router;
