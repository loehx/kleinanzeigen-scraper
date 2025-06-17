const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { searchItems, getItemDetails } = require("./kleinanzeigen");

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
      let detailsFetched = 0;
      let detailsSkipped = 0;

      // Process each item
      for (const item of items) {
        if (!item.id) continue;

        const docRef = db.collection("nachmieter_listings").doc(item.id);
        const existingDoc = await docRef.get();

        let itemData = { ...item };
        let needsDetailsFetch = false;

        if (existingDoc.exists) {
          const existingData = existingDoc.data();

          // Check if we need to fetch detailed information
          needsDetailsFetch =
            !existingData.detailedInfoFetched ||
            !existingData.fullDescription ||
            !existingData.allImages ||
            existingData.allImages.length <= 1;

          // Update existing item with latest data
          await docRef.update({
            ...item,
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          updatedItems++;
          console.log(`🔄 Updated item: ${item.id}`);
        } else {
          // New item - always fetch detailed information
          needsDetailsFetch = true;

          // Add new item
          await docRef.set({
            ...itemData,
            firstSeen: admin.firestore.FieldValue.serverTimestamp(),
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
            isActive: true,
            detailedInfoFetched: false,
          });
          newItems++;
          console.log(`✅ Added new item: ${item.id} - ${item.title}`);
        }

        // Fetch detailed information if needed
        if (needsDetailsFetch) {
          try {
            console.log(`🔍 Fetching detailed info for: ${item.id}`);

            const detailedInfo = await getItemDetails(item.id);

            // Merge detailed information with existing data
            const enhancedData = {
              // Keep original data
              ...itemData,
              // Override with more detailed information
              fullDescription: detailedInfo.description || itemData.description,
              allImages:
                detailedInfo.images && detailedInfo.images.length > 0
                  ? detailedInfo.images
                  : itemData.images,
              detailedTitle: detailedInfo.title || itemData.title,
              detailedLocation: detailedInfo.location || itemData.location,
              detailedPrice: detailedInfo.price || itemData.price,
              additionalDetails: detailedInfo.additionalDetails || {},
              // Metadata
              detailedInfoFetched: true,
              detailsFetchedAt: admin.firestore.FieldValue.serverTimestamp(),
              lastSeen: admin.firestore.FieldValue.serverTimestamp(),
              scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            // Only add postedDate if it exists (avoid undefined values)
            if (detailedInfo.postedDate) {
              enhancedData.postedDate = detailedInfo.postedDate;
            }

            // Update with detailed information
            await docRef.update(enhancedData);
            detailsFetched++;
            console.log(`📋 Enhanced item with details: ${item.id}`);

            // Add small delay to avoid overwhelming the server
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (detailError) {
            console.error(
              `❌ Failed to fetch details for ${item.id}:`,
              detailError.message
            );

            // Mark as attempted but failed
            await docRef.update({
              detailedInfoFetched: false,
              detailsFetchError: detailError.message,
              detailsFetchAttemptedAt:
                admin.firestore.FieldValue.serverTimestamp(),
            });

            detailsSkipped++;
          }
        } else {
          detailsSkipped++;
          console.log(`⏭️  Skipped details for ${item.id} (already fetched)`);
        }
      }

      // Log scraping statistics
      const stats = {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        totalFound: items.length,
        newItems,
        updatedItems,
        detailsFetched,
        detailsSkipped,
        query: "nachmieter",
        source: "scheduled-cron",
      };

      await db.collection("scraping_stats").add(stats);

      console.log(`🎯 Scraping completed:`);
      console.log(`   📥 Total found: ${items.length}`);
      console.log(`   ✨ New items: ${newItems}`);
      console.log(`   🔄 Updated items: ${updatedItems}`);
      console.log(`   📋 Details fetched: ${detailsFetched}`);
      console.log(`   ⏭️  Details skipped: ${detailsSkipped}`);

      return {
        success: true,
        newItems,
        updatedItems,
        detailsFetched,
        detailsSkipped,
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
        source: "scheduled-cron",
      });

      throw error;
    }
  });

// Manual trigger function for testing
exports.manualScrapeNachmieter = functions.https.onRequest(async (req, res) => {
  console.log("🚀 Manual scrape triggered");

  try {
    // Call the scheduled function handler directly
    const result = await exports.scrapeNachmieter.handler();
    res.json({ success: true, result });
  } catch (error) {
    console.error("❌ Manual scrape failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Function to manually fetch details for specific items
exports.fetchItemDetails = functions.https.onRequest(async (req, res) => {
  try {
    const itemId = req.query.itemId;
    const forceRefetch = req.query.force === "true";

    if (!itemId) {
      return res
        .status(400)
        .json({ success: false, error: "itemId parameter required" });
    }

    console.log(`🔍 Manual detail fetch for item: ${itemId}`);

    const docRef = db.collection("nachmieter_listings").doc(itemId);
    const existingDoc = await docRef.get();

    if (!existingDoc.exists) {
      return res.status(404).json({ success: false, error: "Item not found" });
    }

    const existingData = existingDoc.data();

    // Check if we should fetch details
    if (!forceRefetch && existingData.detailedInfoFetched) {
      return res.json({
        success: true,
        message: "Details already fetched",
        item: existingData,
        skipped: true,
      });
    }

    // Fetch detailed information
    const detailedInfo = await getItemDetails(itemId);

    // Merge detailed information
    const enhancedData = {
      ...existingData,
      fullDescription: detailedInfo.description || existingData.description,
      allImages:
        detailedInfo.images && detailedInfo.images.length > 0
          ? detailedInfo.images
          : existingData.images,
      detailedTitle: detailedInfo.title || existingData.title,
      detailedLocation: detailedInfo.location || existingData.location,
      detailedPrice: detailedInfo.price || existingData.price,
      additionalDetails: detailedInfo.additionalDetails || {},
      detailedInfoFetched: true,
      detailsFetchedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSeen: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Only add postedDate if it exists (avoid undefined values)
    if (detailedInfo.postedDate) {
      enhancedData.postedDate = detailedInfo.postedDate;
    }

    await docRef.update(enhancedData);

    console.log(`✅ Details fetched and saved for: ${itemId}`);

    res.json({
      success: true,
      message: "Details fetched successfully",
      item: enhancedData,
      detailedInfo,
    });
  } catch (error) {
    console.error("❌ Failed to fetch item details:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Function to get stored listings
exports.getNachmieterListings = functions.https.onRequest(async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const withDetails = req.query.details === "true";

    let query = db
      .collection("nachmieter_listings")
      .where("isActive", "==", true)
      .orderBy("lastSeen", "desc")
      .limit(limit)
      .offset(offset);

    // Optionally filter for items with detailed info
    if (withDetails) {
      query = query.where("detailedInfoFetched", "==", true);
    }

    const snapshot = await query.get();

    const listings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      firstSeen: doc.data().firstSeen?.toDate(),
      lastSeen: doc.data().lastSeen?.toDate(),
      scrapedAt: doc.data().scrapedAt?.toDate(),
      detailsFetchedAt: doc.data().detailsFetchedAt?.toDate(),
    }));

    // Count items with detailed info
    const detailedCount = listings.filter(
      (item) => item.detailedInfoFetched
    ).length;

    res.json({
      success: true,
      listings,
      count: listings.length,
      detailedCount,
      withDetailsFilter: withDetails,
    });
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
