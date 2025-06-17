const express = require("express");
const admin = require("firebase-admin");
const path = require("path");
require("dotenv").config();

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

app.listen(port, (err) => {
  if (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
  console.log(`Server running on port ${port}`);
});
