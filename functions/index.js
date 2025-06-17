const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { searchItems } = require("./kleinanzeigen");

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Scheduled function to scrape "nachmieter" listings every 30 minutes
exports.scrapeNachmieter = functions.pubsub
  .schedule("every 30 minutes")
  .timeZone("Europe/Berlin")
  .onRun(async (context) => {
    console.log('🕐 Starting scheduled scrape for "nachmieter"...');

    try {
      // Scrape latest "nachmieter" listings
      const items = await searchItems({
        query: "nachmieter",
        limit: 50, // Get more items for better coverage
      });

      console.log(`📥 Found ${items.length} items`);

      let newItems = 0;
      let updatedItems = 0;

      // Process each item
      for (const item of items) {
        if (!item.id) continue;

        const docRef = db.collection("nachmieter_listings").doc(item.id);
        const existingDoc = await docRef.get();

        if (existingDoc.exists) {
          // Update existing item with latest data
          await docRef.update({
            ...item,
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          updatedItems++;
          console.log(`🔄 Updated item: ${item.id}`);
        } else {
          // Add new item
          await docRef.set({
            ...item,
            firstSeen: admin.firestore.FieldValue.serverTimestamp(),
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
            isActive: true,
          });
          newItems++;
          console.log(`✅ Added new item: ${item.id} - ${item.title}`);
        }
      }

      // Log scraping statistics
      const stats = {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        totalFound: items.length,
        newItems,
        updatedItems,
        query: "nachmieter",
      };

      await db.collection("scraping_stats").add(stats);

      console.log(
        `🎯 Scraping completed: ${newItems} new, ${updatedItems} updated`
      );

      return {
        success: true,
        newItems,
        updatedItems,
        totalFound: items.length,
      };
    } catch (error) {
      console.error("❌ Scraping failed:", error);

      // Log error to Firestore
      await db.collection("scraping_errors").add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        error: error.message,
        stack: error.stack,
        query: "nachmieter",
      });

      throw error;
    }
  });

// Manual trigger function for testing
exports.manualScrapeNachmieter = functions.https.onRequest(async (req, res) => {
  console.log("🚀 Manual scrape triggered");

  try {
    const result = await exports.scrapeNachmieter.handler();
    res.json({ success: true, result });
  } catch (error) {
    console.error("❌ Manual scrape failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Function to get stored listings
exports.getNachmieterListings = functions.https.onRequest(async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const snapshot = await db
      .collection("nachmieter_listings")
      .where("isActive", "==", true)
      .orderBy("lastSeen", "desc")
      .limit(limit)
      .offset(offset)
      .get();

    const listings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      firstSeen: doc.data().firstSeen?.toDate(),
      lastSeen: doc.data().lastSeen?.toDate(),
      scrapedAt: doc.data().scrapedAt?.toDate(),
    }));

    res.json({ success: true, listings, count: listings.length });
  } catch (error) {
    console.error("❌ Failed to get listings:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Function to get scraping statistics
exports.getScrapingStats = functions.https.onRequest(async (req, res) => {
  try {
    const snapshot = await db
      .collection("scraping_stats")
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();

    const stats = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    }));

    res.json({ success: true, stats });
  } catch (error) {
    console.error("❌ Failed to get stats:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
