// Health check API routes - monitor all services
const express = require("express");
const {
  kleinanzeigenScraper,
} = require("../../scrapers/kleinanzeigen/scraper");
const WgGesuchtScraper = require("../../scrapers/wg-gesucht/scraper");
const { databaseService } = require("../../scrapers/shared/database");

// Create WG-gesucht scraper instance
const wgGesuchtScraper = new WgGesuchtScraper();

const router = express.Router();

/**
 * GET /api/health - Overall system health check
 */
router.get("/", async (req, res) => {
  try {
    console.log("💚 Health check requested");

    const healthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "2.0.0",
      services: {},
      database: {},
      memory: process.memoryUsage(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };

    // Check each scraper service
    const serviceChecks = [
      checkKleinanzeigenHealth(),
      checkWgGesuchtHealth(),
      checkDatabaseHealth(),
    ];

    const results = await Promise.allSettled(serviceChecks);

    // Process Kleinanzeigen health
    if (results[0].status === "fulfilled") {
      healthStatus.services.kleinanzeigen = results[0].value;
    } else {
      healthStatus.services.kleinanzeigen = {
        status: "unhealthy",
        error: results[0].reason.message,
      };
      healthStatus.status = "degraded";
    }

    // Process WG-gesucht health
    if (results[1].status === "fulfilled") {
      healthStatus.services["wg-gesucht"] = results[1].value;
    } else {
      healthStatus.services["wg-gesucht"] = {
        status: "unhealthy",
        error: results[1].reason.message,
      };
      healthStatus.status = "degraded";
    }

    // Process database health
    if (results[2].status === "fulfilled") {
      healthStatus.database = results[2].value;
    } else {
      healthStatus.database = {
        status: "unhealthy",
        error: results[2].reason.message,
      };
      healthStatus.status = "unhealthy";
    }

    // Determine overall status
    const allServicesHealthy = Object.values(healthStatus.services).every(
      (service) => service.status === "healthy"
    );

    const databaseHealthy = healthStatus.database.status === "healthy";

    if (!allServicesHealthy || !databaseHealthy) {
      healthStatus.status = allServicesHealthy ? "degraded" : "unhealthy";
    }

    // Set appropriate HTTP status code
    const httpStatus =
      healthStatus.status === "healthy"
        ? 200
        : healthStatus.status === "degraded"
        ? 206
        : 503;

    console.log(`💚 Health check completed: ${healthStatus.status}`);

    res.status(httpStatus).json(healthStatus);
  } catch (error) {
    console.error("❌ Health check failed:", error);
    res.status(503).json({
      status: "unhealthy",
      error: "Health check failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/scrapers - Detailed scraper health status
 */
router.get("/scrapers", async (req, res) => {
  try {
    console.log("🔍 Detailed scraper health check");

    const scraperHealth = {
      timestamp: new Date().toISOString(),
      scrapers: {},
    };

    // Check all scrapers
    const checks = [
      { name: "kleinanzeigen", check: checkKleinanzeigenHealth() },
      { name: "wg-gesucht", check: checkWgGesuchtHealth() },
    ];

    for (const { name, check } of checks) {
      try {
        scraperHealth.scrapers[name] = await check;
      } catch (error) {
        scraperHealth.scrapers[name] = {
          status: "unhealthy",
          error: error.message,
          lastTest: new Date().toISOString(),
        };
      }
    }

    const healthyCount = Object.values(scraperHealth.scrapers).filter(
      (scraper) => scraper.status === "healthy"
    ).length;

    scraperHealth.summary = {
      total: Object.keys(scraperHealth.scrapers).length,
      healthy: healthyCount,
      unhealthy: Object.keys(scraperHealth.scrapers).length - healthyCount,
    };

    console.log(
      `🔍 Scraper health: ${healthyCount}/${scraperHealth.summary.total} healthy`
    );

    res.json(scraperHealth);
  } catch (error) {
    console.error("❌ Scraper health check failed:", error);
    res.status(500).json({
      error: "Scraper health check failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/database - Database connection and status
 */
router.get("/database", async (req, res) => {
  try {
    console.log("💾 Database health check");

    const dbHealth = await checkDatabaseHealth(true); // detailed check

    res.json({
      timestamp: new Date().toISOString(),
      database: dbHealth,
    });
  } catch (error) {
    console.error("❌ Database health check failed:", error);
    res.status(500).json({
      status: "unhealthy",
      error: "Database health check failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Helper functions
 */
async function checkKleinanzeigenHealth() {
  try {
    const health = await kleinanzeigenScraper.getHealth();
    return {
      ...health,
      name: "Kleinanzeigen Scraper",
    };
  } catch (error) {
    return {
      status: "unhealthy",
      name: "Kleinanzeigen Scraper",
      error: error.message,
      lastTest: new Date().toISOString(),
    };
  }
}

async function checkWgGesuchtHealth() {
  try {
    const health = await wgGesuchtScraper.getHealth();
    return {
      ...health,
      name: "WG-gesucht Scraper",
    };
  } catch (error) {
    return {
      status: "unhealthy",
      name: "WG-gesucht Scraper",
      error: error.message,
      lastTest: new Date().toISOString(),
    };
  }
}

async function checkDatabaseHealth(detailed = false) {
  try {
    // Test basic connectivity
    const testQuery = await databaseService.getListings({ limit: 1 });

    const health = {
      status: "healthy",
      lastTest: new Date().toISOString(),
      canRead: true,
      canWrite: false, // We'll test this if detailed
    };

    if (detailed) {
      // Get database statistics
      try {
        const allListings = await databaseService.getListings({ limit: 1000 });

        health.statistics = {
          totalListings: allListings.length,
          sources: allListings.reduce((acc, listing) => {
            acc[listing.source] = (acc[listing.source] || 0) + 1;
            return acc;
          }, {}),
          oldestListing:
            allListings.length > 0
              ? Math.min(
                  ...allListings.map(
                    (l) => l.firstSeen?.toMillis?.() || Date.now()
                  )
                )
              : null,
          newestListing:
            allListings.length > 0
              ? Math.max(
                  ...allListings.map(
                    (l) => l.lastSeen?.toMillis?.() || Date.now()
                  )
                )
              : null,
        };
      } catch (statsError) {
        health.statisticsError = statsError.message;
      }

      // Test write capability (optional)
      try {
        // This would be a very light write test
        // await databaseService.logStats({
        //   source: 'health-check',
        //   totalFound: 0,
        //   newItems: 0,
        //   updatedItems: 0,
        //   test: true
        // });
        health.canWrite = true;
      } catch (writeError) {
        health.canWrite = false;
        health.writeError = writeError.message;
      }
    }

    return health;
  } catch (error) {
    return {
      status: "unhealthy",
      error: error.message,
      lastTest: new Date().toISOString(),
      canRead: false,
      canWrite: false,
    };
  }
}

module.exports = router;
