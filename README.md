# eBay Kleinanzeigen Scraper

This service provides an API that lets you easily fetch the latest items from eBay Kleinanzeigen.

## API Structure

### Endpoints

#### GET /api/items
Fetches items based on search criteria

Query Parameters:
- `query` (string): Search term
- `category` (string): Category ID
- `location` (string): Location name
- `radius` (number): Search radius in km
- `minPrice` (number): Minimum price
- `maxPrice` (number): Maximum price
- `offset` (number): Page number
- `limit` (number): Items per page

Example:

```
{
    "query": "",
    "category": "123",
    "location": "Berlin",
    "radius": 10,
    "minPrice": 100,
    "maxPrice": 500,
    "offset": 0,
    "limit": 20
}
```

Response:

``` 
{
    "success": true,
    "items": [
        {
            "id": "123456789",
            "title": "iPhone 12 Pro Max",
            "description": "Selling my iPhone 12 Pro Max in perfect condition...",
            "price": 799.99,
            "currency": "EUR",
            "location": "Berlin",
            "distance": 5.2,
            "images": [
                "https://example.com/image1.jpg",
                "https://example.com/image2.jpg"
            ],
            "url": "https://www.ebay-kleinanzeigen.de/item/123456789",
            "createdAt": "2024-03-20T10:30:00Z",
            "seller": {
                "name": "John Doe",
                "rating": 4.8,
                "memberSince": "2020-01-01"
            }
        },
        ...
    ]
}
```


