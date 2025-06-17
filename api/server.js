// Unified API Server for Multi-Source Rental Aggregator
const express = require("express");
const cors = require("cors");
const { databaseService } = require("../scrapers/shared/database");
const { kleinanzeigenScraper } = require("../scrapers/kleinanzeigen/scraper");

// Import route handlers
const listingsRoutes = require("./routes/listings");
const searchRoutes = require("./routes/search");
const healthRoutes = require("./routes/health");

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/listings", listingsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/health", healthRoutes);

// Legacy compatibility routes (for existing frontend)
app.get("/api/items", async (req, res) => {
  try {
    console.log("🔍 Legacy /api/items endpoint called");

    // Use the search functionality
    const query = req.query.query || "nachmieter";
    const limit = parseInt(req.query.limit) || 20;

    // Search across all sources (for now just Kleinanzeigen)
    const items = await kleinanzeigenScraper.search({
      query: query,
      limit: limit,
    });

    res.json({
      success: true,
      items: items,
      source: "unified",
      count: items.length,
    });
  } catch (error) {
    console.error("❌ Legacy search failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      source: "unified",
    });
  }
});

app.get("/api/items/:id", async (req, res) => {
  try {
    const itemId = req.params.id;
    console.log(`🔍 Legacy item detail request for ID: ${itemId}`);

    // Get item from database
    const listings = await databaseService.getListings({
      id: itemId,
      limit: 1,
    });

    if (listings.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Item not found",
      });
    }

    res.json({
      success: true,
      item: listings[0],
    });
  } catch (error) {
    console.error("❌ Legacy item detail failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    name: "Multi-Source Rental Aggregator API",
    version: "2.0.0",
    sources: ["kleinanzeigen", "wg-gesucht"],
    endpoints: {
      listings: "/api/listings",
      search: "/api/search",
      health: "/api/health",
      legacy: {
        items: "/api/items",
        item_detail: "/api/items/:id",
      },
    },
    status: "operational",
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("❌ API Error:", error);

  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: error.message,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    path: req.path,
    method: req.method,
    availableEndpoints: [
      "/api/listings",
      "/api/search",
      "/api/health",
      "/api/items",
      "/health",
    ],
  });
});

// Start server
app.listen(port, (err) => {
  if (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }

  console.log("\n🚀 Multi-Source Rental Aggregator API started!");
  console.log(`📡 Server running on port ${port}`);
  console.log(`🌐 Available at: http://localhost:${port}`);
  console.log(`📖 API docs: http://localhost:${port}/`);
  console.log(`💚 Health check: http://localhost:${port}/health`);
  console.log("\n📋 Available endpoints:");
  console.log("   GET  /api/listings     - Get all listings (unified)");
  console.log("   GET  /api/search       - Search across all sources");
  console.log("   GET  /api/health       - Service health status");
  console.log("   GET  /api/items        - Legacy compatibility");
  console.log("\n✅ Ready to serve requests!\n");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n🛑 SIGINT received, shutting down gracefully");
  process.exit(0);
});

module.exports = app;
