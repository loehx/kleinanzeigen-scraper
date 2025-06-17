const admin = require("firebase-admin");
require("dotenv").config();

// Initialize Firebase Admin
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.firestore();

async function checkDatabase() {
  console.log("🔍 Checking Firestore database...\n");

  try {
    // Check nachmieter listings
    console.log("📋 NACHMIETER LISTINGS:");
    console.log("========================");

    const listingsSnapshot = await db
      .collection("nachmieter_listings")
      .orderBy("lastSeen", "desc")
      .limit(10)
      .get();

    if (listingsSnapshot.empty) {
      console.log("❌ No nachmieter listings found");
      console.log(
        "💡 Run the scraper first or deploy to start collecting data\n"
      );
    } else {
      console.log(`✅ Found ${listingsSnapshot.size} listings:\n`);

      listingsSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`${index + 1}. ${data.title}`);
        console.log(
          `   💰 Price: ${
            data.price ? `${data.price} ${data.currency}` : "N/A"
          }`
        );
        console.log(`   📍 Location: ${data.location}`);
        console.log(`   🆔 ID: ${doc.id}`);
        console.log(
          `   👀 First seen: ${
            data.firstSeen?.toDate()?.toLocaleString() || "N/A"
          }`
        );
        console.log(
          `   🔄 Last seen: ${
            data.lastSeen?.toDate()?.toLocaleString() || "N/A"
          }`
        );
        console.log(`   🔗 URL: ${data.url}\n`);
      });
    }

    // Check scraping stats
    console.log("📊 SCRAPING STATISTICS:");
    console.log("=======================");

    const statsSnapshot = await db
      .collection("scraping_stats")
      .orderBy("timestamp", "desc")
      .limit(5)
      .get();

    if (statsSnapshot.empty) {
      console.log("❌ No scraping statistics found");
      console.log(
        "💡 Statistics will appear after the first scheduled scrape\n"
      );
    } else {
      console.log(`✅ Found ${statsSnapshot.size} scraping runs:\n`);

      statsSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(
          `${index + 1}. Scrape on ${data.timestamp
            ?.toDate()
            ?.toLocaleString()}`
        );
        console.log(`   📥 Total found: ${data.totalFound}`);
        console.log(`   ✨ New items: ${data.newItems}`);
        console.log(`   🔄 Updated items: ${data.updatedItems}`);
        console.log(`   🔍 Query: "${data.query}"\n`);
      });
    }

    // Check for errors
    console.log("⚠️  RECENT ERRORS:");
    console.log("==================");

    const errorsSnapshot = await db
      .collection("scraping_errors")
      .orderBy("timestamp", "desc")
      .limit(3)
      .get();

    if (errorsSnapshot.empty) {
      console.log("✅ No errors found - system running smoothly!\n");
    } else {
      console.log(`❌ Found ${errorsSnapshot.size} recent errors:\n`);

      errorsSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(
          `${index + 1}. Error on ${data.timestamp?.toDate()?.toLocaleString()}`
        );
        console.log(`   💥 Message: ${data.error}`);
        console.log(`   🔍 Query: "${data.query}"\n`);
      });
    }

    // Summary
    console.log("📈 SUMMARY:");
    console.log("===========");
    console.log(`📋 Total listings: ${listingsSnapshot.size}`);
    console.log(`📊 Scraping runs: ${statsSnapshot.size}`);
    console.log(`⚠️  Errors: ${errorsSnapshot.size}`);
  } catch (error) {
    console.error("❌ Database check failed:", error.message);

    if (error.message.includes("permission-denied")) {
      console.log("\n💡 This might be because:");
      console.log("   - Firestore rules haven't been deployed yet");
      console.log("   - Service account doesn't have proper permissions");
      console.log("   - Database hasn't been initialized");
    }
  }

  process.exit(0);
}

checkDatabase();
