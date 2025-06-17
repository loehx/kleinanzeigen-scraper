const admin = require("firebase-admin");
const path = require("path");
require("dotenv").config();

// Initialize Firebase Admin (singleton pattern)
let db = null;
let firestore = null;

function initializeFirebase() {
  if (db && firestore) {
    return { db, firestore };
  }

  try {
    // Only initialize if not already done
    if (!admin.apps.length) {
      const serviceAccount = require(path.join(
        process.cwd(),
        "serviceAccountKey.json"
      ));

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });
    }

    db = admin.database();
    firestore = admin.firestore();

    // Configure Firestore to ignore undefined values
    firestore.settings({ ignoreUndefinedProperties: true });

    console.log("✅ Firebase initialized successfully");
    return { db, firestore };
  } catch (error) {
    console.error("❌ Firebase initialization failed:", error.message);
    throw error;
  }
}

// Unified collection names
const COLLECTIONS = {
  LISTINGS: "rental_listings", // Unified collection for all sources
  STATS: "scraping_stats",
  ERRORS: "scraping_errors",
};

// Database operations
class DatabaseService {
  constructor() {
    const { firestore: fs } = initializeFirebase();
    this.firestore = fs;
  }

  // Save or update a listing
  async saveOrUpdateListing(listingData) {
    try {
      const docRef = this.firestore
        .collection(COLLECTIONS.LISTINGS)
        .doc(listingData.id);
      const existingDoc = await docRef.get();

      const timestamp = admin.firestore.FieldValue.serverTimestamp();

      if (existingDoc.exists) {
        // Update existing listing
        await docRef.update({
          ...listingData,
          lastSeen: timestamp,
          scrapedAt: timestamp,
        });
        console.log(
          `🔄 Updated listing: ${listingData.id} from ${listingData.source}`
        );
        return { action: "updated", id: listingData.id };
      } else {
        // Create new listing
        await docRef.set({
          ...listingData,
          firstSeen: timestamp,
          lastSeen: timestamp,
          scrapedAt: timestamp,
          isActive: true,
        });
        console.log(
          `✅ Added new listing: ${listingData.id} from ${listingData.source}`
        );
        return { action: "created", id: listingData.id };
      }
    } catch (error) {
      console.error(
        `❌ Failed to save listing ${listingData.id}:`,
        error.message
      );
      throw error;
    }
  }

  // Get listings with filters
  async getListings(filters = {}) {
    try {
      let query = this.firestore.collection(COLLECTIONS.LISTINGS);

      // Apply filters
      if (filters.source) {
        query = query.where("source", "==", filters.source);
      }

      if (filters.isActive !== undefined) {
        query = query.where("isActive", "==", filters.isActive);
      }

      if (filters.minPrice) {
        query = query.where("price", ">=", filters.minPrice);
      }

      if (filters.maxPrice) {
        query = query.where("price", "<=", filters.maxPrice);
      }

      // Apply ordering and limit
      query = query.orderBy("lastSeen", "desc");

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const snapshot = await query.get();
      const listings = [];

      snapshot.forEach((doc) => {
        listings.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return listings;
    } catch (error) {
      console.error("❌ Failed to get listings:", error.message);
      throw error;
    }
  }

  // Log scraping statistics
  async logStats(stats) {
    try {
      await this.firestore.collection(COLLECTIONS.STATS).add({
        ...stats,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(
        `📊 Logged stats for ${stats.source}: ${stats.totalFound} items`
      );
    } catch (error) {
      console.error("❌ Failed to log stats:", error.message);
      throw error;
    }
  }

  // Log errors
  async logError(error, context = {}) {
    try {
      await this.firestore.collection(COLLECTIONS.ERRORS).add({
        error: error.message,
        stack: error.stack,
        context,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`⚠️ Logged error: ${error.message}`);
    } catch (logError) {
      console.error("❌ Failed to log error:", logError.message);
    }
  }

  // Mark listings as inactive (for cleanup)
  async markListingsInactive(source, olderThan) {
    try {
      const cutoffTime = new Date(Date.now() - olderThan);
      const query = this.firestore
        .collection(COLLECTIONS.LISTINGS)
        .where("source", "==", source)
        .where("lastSeen", "<", cutoffTime)
        .where("isActive", "==", true);

      const snapshot = await query.get();
      const batch = this.firestore.batch();
      let count = 0;

      snapshot.forEach((doc) => {
        batch.update(doc.ref, { isActive: false });
        count++;
      });

      if (count > 0) {
        await batch.commit();
        console.log(`🗑️ Marked ${count} old ${source} listings as inactive`);
      }

      return count;
    } catch (error) {
      console.error("❌ Failed to mark listings inactive:", error.message);
      throw error;
    }
  }
}

// Export singleton instance
const databaseService = new DatabaseService();

module.exports = {
  DatabaseService,
  databaseService,
  COLLECTIONS,
  initializeFirebase,
};
