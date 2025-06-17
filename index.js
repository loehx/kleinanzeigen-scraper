const express = require("express");
const admin = require("firebase-admin");
const path = require("path");
require("dotenv").config();
const { searchItems, getItemDetails } = require("./scraper/kleinanzeigen");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
} catch (err) {
  console.error("Firebase init error:", err);
}

const db = admin.database();
const app = express();
const port = process.env.PORT || 4000;

app.get("/health", (req, res) => {
  console.log("Health check called");
  res.json({ status: "ok" });
});

app.get("/api/items", async (req, res) => {
  try {
    const items = await searchItems(req.query);
    res.json({ success: true, items });
  } catch (err) {
    console.error("Error in /api/items:", err);
    res.status(500).json({
      success: false,
      error: err.message || String(err),
      stack: err.stack,
    });
  }
});

app.get("/api/items/:id", async (req, res) => {
  try {
    const itemId = req.params.id;
    if (!itemId || !/^\d+$/.test(itemId)) {
      return res.status(400).json({ success: false, error: "Invalid item ID" });
    }
    const itemDetails = await getItemDetails(itemId);
    res.json({ success: true, item: itemDetails });
  } catch (err) {
    console.error("Error in /api/items/:id:", err);
    res
      .status(500)
      .json({
        success: false,
        error: err.message || String(err),
        stack: err.stack,
      });
  }
});

app.listen(port, (err) => {
  if (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
  console.log(`Server running on port ${port}`);
});
