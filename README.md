# eBay Kleinanzeigen Scraper

This service provides an API that lets you easily fetch the latest items from eBay Kleinanzeigen.

## API Structure

### Endpoints

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

**Response:**
```json
{
    "success": true,
    "items": [
        {
            "id": "3098445492",
            "title": "Woom 4 Fahrrad in Blau",
            "description": "Verkaufen unser Woom 4 Fahrrad in Blau da unser Junge zu groß dafür ist.",
            "price": 350,
            "currency": "EUR",
            "location": "80803 Schwabing-Freimann",
            "distance": null,
            "images": [
                "https://img.kleinanzeigen.de/api/v1/prod-ads/images/e9/e99302b4-424f-449b-83b3-3dca6d33f341?rule=$_2.AUTO"
            ],
            "url": "https://www.kleinanzeigen.de/s-anzeige/woom-4-fahrrad-in-blau/3098445492-217-16380",
            "createdAt": "2025-06-17T08:51:18.667Z",
            "seller": {
                "name": "",
                "rating": null,
                "memberSince": ""
            }
        }
    ]
}
```

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file with:
   ```
   FIREBASE_DATABASE_URL=your_firebase_url
   ```

3. **Add your Firebase service account key:**
   Place `serviceAccountKey.json` in the project root

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Test the API:**
   ```bash
   curl "http://localhost:4000/api/items?query=fahrrad&limit=2"
   ```

## Health Check

Check if the service is running:
```
GET /health
```

Returns:
```json
{
    "status": "ok"
}
```


