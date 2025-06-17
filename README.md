# eBay Kleinanzeigen Scraper

This service provides an API that lets you easily fetch the latest items from eBay Kleinanzeigen, with **automated continuous scraping** for "nachmieter" (subletting) listings using Firebase Cloud Functions.

## 🚀 Features

- **Real-time API** for searching Kleinanzeigen
- **Automated Scraping** with Firebase Cloud Functions
- **Scheduled Collection** of nachmieter listings every 30 minutes
- **Firestore Database** for persistent storage
- **Deduplication** to avoid storing duplicate listings
- **Statistics & Monitoring** with error logging

## 📋 API Structure

### Regular Search API

#### GET /api/items
Fetches items based on search criteria

**Query Parameters:**
- `query` (string): Search term
- `location` (string): Location name
- `radius` (number): Search radius in km
- `minPrice` (number): Minimum price
- `maxPrice` (number): Maximum price
- `offset` (number): Page number (0-based)
- `limit` (number): Items per page (default: 20)

**Example Request:**
```
GET /api/items?query=fahrrad&location=Berlin&minPrice=100&maxPrice=500&limit=5
```

### 🏠 Automated Nachmieter Functions

#### GET /getNachmieterListings
Get stored nachmieter listings from Firestore

**Query Parameters:**
- `limit` (number): Number of listings (default: 20)
- `offset` (number): Page offset (default: 0)

**Example:**
```
https://your-project.cloudfunctions.net/getNachmieterListings?limit=10
```

#### GET /getScrapingStats
Get scraping statistics and monitoring data

**Example:**
```
https://your-project.cloudfunctions.net/getScrapingStats
```

#### GET /manualScrapeNachmieter
Manually trigger nachmieter scraping (for testing)

## 🛠️ Setup Guide

### 1. Regular API Setup

```bash
# Install dependencies
npm install

# Set up environment variables
echo "FIREBASE_DATABASE_URL=your_firebase_url" > .env

# Add Firebase service account key
# Place serviceAccountKey.json in project root

# Start development server
npm run dev
```

### 2. Firebase Cloud Functions Setup

#### Prerequisites
- Firebase project on **Blaze plan** (pay-as-you-go)
- Firebase CLI installed: `npm install -g firebase-tools`

#### Setup Steps

1. **Login to Firebase:**
   ```bash
   firebase login
   ```

2. **Set your Firebase project:**
   ```bash
   firebase use your-project-id
   ```

3. **Deploy Cloud Functions:**
   ```bash
   firebase deploy --only functions
   ```

4. **Deploy Firestore rules:**
   ```bash
   firebase deploy --only firestore
   ```

#### Firebase Project Configuration

Your `firebase.json` should include:
```json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default"
    }
  ],
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

### 3. Automated Scraping

Once deployed, the system will automatically:

- **Scrape every 30 minutes** for new nachmieter listings
- **Store unique listings** in Firestore
- **Update existing listings** with latest data
- **Track statistics** and errors
- **Provide API endpoints** for accessing stored data

## 🗃️ Database Structure

### Collections

- `nachmieter_listings` - Stored subletting listings
- `scraping_stats` - Scraping statistics and monitoring
- `scraping_errors` - Error logs (admin only)

### Listing Document Structure
```json
{
  "id": "3112883168",
  "title": "Nachmieter/in gesucht -2- Zimmer Wohnung mit Charme",
  "description": "Schöne 2-Zimmer Wohnung...",
  "price": 410,
  "currency": "EUR",
  "location": "06667 Weißenfels",
  "images": ["https://..."],
  "url": "https://www.kleinanzeigen.de/...",
  "firstSeen": "2024-01-15T10:30:00Z",
  "lastSeen": "2024-01-15T11:00:00Z",
  "scrapedAt": "2024-01-15T11:00:00Z",
  "isActive": true
}
```

## 🔧 Local Testing

Test the scraping functionality locally:

```bash
# Test nachmieter scraping
node test-nachmieter.js

# Start Firebase emulators
firebase emulators:start --only functions,firestore
```

## 📊 Monitoring

- **Function Logs:** `firebase functions:log`
- **Firestore Console:** Firebase web console
- **Statistics API:** `/getScrapingStats`
- **Error Tracking:** Stored in `scraping_errors` collection

## 🔒 Security

- **Firestore Rules:** Public read access to listings, function-only writes
- **Error Logs:** Admin access only
- **API Rate Limiting:** Built-in Cloud Functions limits

## 🚀 Example Usage

```javascript
// Get latest nachmieter listings
const response = await fetch('https://your-project.cloudfunctions.net/getNachmieterListings?limit=5');
const data = await response.json();

console.log(`Found ${data.listings.length} nachmieter listings`);
data.listings.forEach(listing => {
  console.log(`${listing.title} - ${listing.price}€ in ${listing.location}`);
});
```

## 📈 Scaling

The system automatically scales with Firebase:
- **Cloud Functions:** Auto-scaling based on demand
- **Firestore:** Handles millions of documents
- **Scheduling:** Reliable Cloud Scheduler
- **Monitoring:** Built-in Firebase monitoring

## 💰 Cost Estimation

Firebase Blaze plan costs (approximate):
- **Cloud Functions:** ~$0.40 per million invocations
- **Firestore:** ~$0.18 per 100k reads, ~$0.18 per 100k writes
- **Scheduling:** Free tier includes 3 jobs
- **Estimated monthly cost:** $5-15 for moderate usage

---

🎯 **Perfect for:** Apartment hunters, real estate agents, market researchers, and anyone needing continuous monitoring of subletting opportunities!


