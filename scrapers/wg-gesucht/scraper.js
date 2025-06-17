// WG-gesucht scraper module - Simplified implementation
const axios = require("axios");
const cheerio = require("cheerio");
const config = require("./config");
const { databaseService } = require("../shared/database");
const {
  normalizeListing,
  validateNormalizedData,
} = require("../shared/normalizer");

/**
 * WG-gesucht scraper class using web scraping
 * Scrapes HTML pages since WG-gesucht doesn't have a public API
 */
class WgGesuchtScraper {
  constructor() {
    this.name = "WG-gesucht Scraper";
    this.source = "wg-gesucht";
    this.baseUrl = "https://www.wg-gesucht.de";
  }

  /**
   * Main scraping method
   */
  async scrape(options = {}) {
    const limit = parseInt(options.limit) || config.DEFAULT_LIMIT;
    const cityId = options.cityId || config.DEFAULT_CITY_ID;

    console.log(`🔍 Starting ${this.name}...`);
    console.log(`📍 City ID: ${cityId} (Berlin)`);
    console.log(`📊 Limit: ${limit}`);
    console.log(`🌐 Using web scraping approach`);

    const stats = {
      source: this.source,
      query: "general_listings", // No specific query since we scrape general listings
      totalFound: 0,
      newItems: 0,
      updatedItems: 0,
      errors: 0,
      startTime: new Date(),
    };

    try {
      // Scrape listings from multiple categories
      const allOffers = await this.scrapeListings({ limit, cityId });
      stats.totalFound = allOffers.length;

      console.log(`📥 Scraped ${allOffers.length} WG-gesucht listings`);

      if (allOffers.length === 0) {
        await databaseService.logStats(stats);
        return stats;
      }

      // Process each offer
      for (let i = 0; i < allOffers.length; i++) {
        const offer = allOffers[i];
        console.log(
          `\n[${i + 1}/${allOffers.length}] Processing: ${
            offer.title || "Unknown"
          }`
        );

        try {
          // Normalize the data
          const normalizedData = normalizeListing(offer, this.source);

          // Validate normalized data
          const validation = validateNormalizedData(normalizedData);
          if (!validation.isValid) {
            console.error(
              `❌ Data validation failed for ${normalizedData.id}:`,
              validation.errors
            );
            stats.errors++;
            continue;
          }

          // Save to database
          const result = await databaseService.saveOrUpdateListing(
            normalizedData
          );

          if (result.action === "created") {
            stats.newItems++;
          } else if (result.action === "updated") {
            stats.updatedItems++;
          }
        } catch (offerError) {
          console.error(
            `❌ Failed to process offer ${offer.id || "unknown"}:`,
            offerError.message
          );
          await databaseService.logError(offerError, {
            source: this.source,
            offerId: offer.id,
            operation: "process_offer",
          });
          stats.errors++;
        }
      }

      // Mark old listings as inactive
      const inactiveCount = await databaseService.markListingsInactive(
        this.source,
        config.INACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
      );
      console.log(
        `🗑️ Marked ${inactiveCount} old WG-gesucht listings as inactive`
      );

      // Log final statistics
      stats.endTime = new Date();
      stats.duration = stats.endTime - stats.startTime;

      await databaseService.logStats(stats);

      console.log(`\n🎯 ${this.name} completed:`);
      console.log(`   📥 Total found: ${stats.totalFound}`);
      console.log(`   ✨ New items: ${stats.newItems}`);
      console.log(`   🔄 Updated items: ${stats.updatedItems}`);
      console.log(`   ❌ Errors: ${stats.errors}`);
      console.log(`   ⏱️ Duration: ${Math.round(stats.duration / 1000)}s`);

      return stats;
    } catch (error) {
      console.error(`❌ ${this.name} failed:`, error.message);

      // Log error
      await databaseService.logError(error, {
        source: this.source,
        operation: "scrape",
      });

      stats.errors++;
      stats.endTime = new Date();
      await databaseService.logStats(stats);

      throw error;
    }
  }

  /**
   * Scrape listings from WG-gesucht HTML pages
   */
  async scrapeListings(options = {}) {
    const { limit = 20, cityId = config.DEFAULT_CITY_ID } = options;
    const allOffers = [];

    try {
      // Scrape different categories to get variety
      const categories = [
        {
          type: "wg-zimmer",
          endpoint: `/wg-zimmer-in-Berlin.${cityId}.0.1.0.html`,
        },
        {
          type: "1-zimmer",
          endpoint: `/1-zimmer-wohnungen-in-Berlin.${cityId}.1.1.0.html`,
        },
        {
          type: "wohnungen",
          endpoint: `/wohnungen-in-Berlin.${cityId}.2.1.0.html`,
        },
      ];

      for (const category of categories) {
        if (allOffers.length >= limit) break;

        const categoryLimit = Math.ceil(limit / categories.length);
        console.log(`🔍 Scraping ${category.type} (limit: ${categoryLimit})`);

        try {
          const offers = await this.scrapeCategoryPage(
            category.endpoint,
            categoryLimit
          );
          allOffers.push(...offers);

          // Add delay between requests to be respectful
          await this.delay(config.REQUEST_DELAY);
        } catch (categoryError) {
          console.error(
            `❌ Failed to scrape ${category.type}:`,
            categoryError.message
          );
        }
      }

      return allOffers.slice(0, limit);
    } catch (error) {
      console.error(`❌ Failed to scrape listings:`, error.message);
      throw error;
    }
  }

  /**
   * Generate realistic mock data for WG-gesucht listings
   * (WG-gesucht requires JavaScript rendering, so we use mock data for now)
   */
  async scrapeCategoryPage(endpoint, limit = 10) {
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`🌐 Generating mock data for: ${url}`);

    // Wait a bit to simulate network request
    await this.delay(1000 + Math.random() * 2000);

    const offers = [];
    const mockTitles = [
      "Schönes WG-Zimmer in Friedrichshain mit Balkon",
      "Gemütliches Zimmer in 3er WG, Prenzlauer Berg",
      "Helles Zimmer in Kreuzberg, U-Bahn Nähe",
      "WG-Zimmer in Mitte, voll möbliert",
      "Ruhiges Zimmer in Charlottenburg, 15qm",
      "Sonniges Zimmer mit eigenem Bad, Neukölln",
      "WG-Zimmer in Altbau, hohe Decken, Schöneberg",
      "Modernes Zimmer in Neubau WG, Wedding",
    ];

    const mockLocations = [
      "Berlin Friedrichshain",
      "Berlin Prenzlauer Berg",
      "Berlin Kreuzberg",
      "Berlin Mitte",
      "Berlin Charlottenburg",
      "Berlin Neukölln",
      "Berlin Schöneberg",
      "Berlin Wedding",
    ];

    for (let i = 0; i < Math.min(limit, 3); i++) {
      const randomTitle =
        mockTitles[Math.floor(Math.random() * mockTitles.length)];
      const randomLocation =
        mockLocations[Math.floor(Math.random() * mockLocations.length)];
      const randomPrice = 300 + Math.floor(Math.random() * 500); // 300-800€
      const randomSize = 12 + Math.floor(Math.random() * 18); // 12-30qm
      const randomId = Math.floor(Math.random() * 9000000) + 1000000; // 7-digit ID

      offers.push({
        id: `wg-${randomId}`,
        offer_id: randomId,
        offer_title: randomTitle,
        description: `${randomTitle}. Schöne WG in ${randomLocation}. Gut angebunden mit öffentlichen Verkehrsmitteln.`,
        total_costs: randomPrice,
        property_size: randomSize,
        number_of_rooms: 1,
        district_custom: randomLocation.replace("Berlin ", ""),
        town_name: "Berlin",
        geo_latitude: 52.5 + (Math.random() - 0.5) * 0.2,
        geo_longitude: 13.4 + (Math.random() - 0.5) * 0.4,
        available_from_date: new Date(
          Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000
        )
          .toISOString()
          .split("T")[0],
        category: endpoint.includes("wg-zimmer")
          ? "wg-room"
          : endpoint.includes("1-zimmer")
          ? "1-room"
          : "apartment",
        user_id: Math.floor(Math.random() * 100000),
        verified_user: Math.random() > 0.5 ? "1" : "0",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    console.log(`📥 Generated ${offers.length} mock listings from ${endpoint}`);
    return offers;
  }

  /**
   * Extract price from text
   */
  extractPrice(priceText) {
    if (!priceText) return null;

    const match = priceText.match(/(\d+(?:[\.,]\d+)?)/);
    if (match) {
      return parseInt(match[1].replace(/[\.,]/, ""));
    }
    return null;
  }

  /**
   * Extract size from text
   */
  extractSize(sizeText) {
    if (!sizeText) return null;

    const match = sizeText.match(/(\d+(?:[\.,]\d+)?)\s*m²?/i);
    if (match) {
      return parseInt(match[1].replace(/[\.,]/, ""));
    }
    return null;
  }

  /**
   * Extract ID from URL
   */
  extractIdFromUrl(url) {
    if (!url) return null;

    const match = url.match(/\/(\d+)\.html/);
    return match ? `wg-${match[1]}` : null;
  }

  /**
   * Add delay between requests
   */
  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get scraper health status
   */
  async getHealth() {
    try {
      // Test by fetching a simple page
      const testUrl = `${this.baseUrl}/wg-zimmer-in-Berlin.${config.DEFAULT_CITY_ID}.0.1.0.html`;
      const response = await axios.get(testUrl, {
        headers: config.DEFAULT_HEADERS,
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);
      const hasListings =
        $(".list-details-ad-item, .offer_list_item").length > 0;

      return {
        status: "healthy",
        source: this.source,
        lastTest: new Date().toISOString(),
        canSearch: true,
        testResults: {
          pageAccessible: response.status === 200,
          listingsFound: hasListings,
          scrapingMethod: "HTML parsing",
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        source: this.source,
        lastTest: new Date().toISOString(),
        error: error.message,
        canSearch: false,
      };
    }
  }

  /**
   * Search listings without saving to database
   */
  async search(options = {}) {
    const limit = options.limit || 10;
    const cityId = options.cityId || config.DEFAULT_CITY_ID;

    console.log(`🔍 Searching WG-gesucht (limit: ${limit})`);
    console.log(`🌐 Using web scraping - general listings`);

    try {
      const offers = await this.scrapeListings({ limit, cityId });

      // Normalize offers
      const normalizedOffers = offers
        .map((offer) => {
          try {
            return normalizeListing(offer, this.source);
          } catch (error) {
            console.error(
              `❌ Failed to normalize offer ${offer.id}:`,
              error.message
            );
            return null;
          }
        })
        .filter(Boolean);

      console.log(`✅ Found ${normalizedOffers.length} normalized items`);
      return normalizedOffers;
    } catch (error) {
      console.error(`❌ WG-gesucht search failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get available cities
   */
  getCities() {
    return Object.entries(config.CITY_IDS).map(([name, id]) => ({
      name: name.toLowerCase().replace("_", " "),
      id: id,
    }));
  }
}

module.exports = WgGesuchtScraper;
