# Project Architecture: Multi-Source Rental Aggregator

## 🏗️ **Architecture Overview**

This project is designed as a **modular, scalable system** that aggregates rental listings from multiple German platforms (Kleinanzeigen, WG-gesucht) into a unified database.

## 📁 **New Project Structure**

```
kleinanzeigen-scraper/
├── api/                          # Main API module
│   ├── server.js                # Express server & unified endpoints
│   ├── routes/                  # API routes
│   │   ├── listings.js         # GET /api/listings (unified)
│   │   ├── search.js           # GET /api/search
│   │   └── health.js           # Health checks
│   └── middleware/              # Auth, validation, etc.
│
├── scrapers/                     # Microservices for data collection
│   ├── kleinanzeigen/           # Kleinanzeigen scraper service
│   │   ├── scraper.js          # Main scraper logic
│   │   ├── parser.js           # HTML parsing & data extraction
│   │   └── config.js           # URLs, selectors, etc.
│   │
│   ├── wg-gesucht/             # WG-gesucht service
│   │   ├── api-client.js       # API client (preferred)
│   │   ├── scraper.js          # Fallback scraper
│   │   └── config.js           # API endpoints, auth
│   │
│   └── shared/                  # Shared utilities
│       ├── database.js         # Firebase/Firestore client
│       ├── normalizer.js       # Data standardization
│       └── utils.js            # Common functions
│
├── scheduler/                    # Orchestration service
│   ├── cron-jobs.js            # Scheduled scraping
│   ├── orchestrator.js         # Coordinate multiple sources
│   └── queue.js                # Job queue management
│
├── database/                     # Database layer
│   ├── schema.js               # Unified data schema
│   ├── migrations.js           # Database updates
│   └── queries.js              # Common queries
│
├── functions/                    # Firebase Functions (existing)
│   └── index.js                # Deployed cloud functions
│
├── config/                       # Configuration
│   ├── database.js             # DB connection settings
│   ├── scrapers.js             # Scraper configurations
│   └── api.js                  # API settings
│
└── utils/                        # Global utilities
    ├── logger.js               # Centralized logging
    ├── validators.js           # Data validation
    └── transformers.js         # Data transformation
```

## 🔄 **Data Flow Architecture**

```
[WG-gesucht API] ──┐
                   ├──> [Data Normalizer] ──> [Unified DB] ──> [API Server]
[Kleinanzeigen]  ──┘                                           ↗
                                                        [Web Client]
[Future Source] ──> [New Scraper] ──> [Normalizer] ──────┘
```

## 📊 **Unified Data Schema**

All listings will be stored with this standardized structure:

```javascript
{
  id: "unique_id",
  source: "kleinanzeigen" | "wg-gesucht" | "future-source",
  sourceId: "original_platform_id",
  
  // Core information
  title: "string",
  description: "string",
  fullDescription: "string",
  price: number,
  currency: "EUR",
  
  // Location
  location: "string",
  detailedLocation: "string",
  coordinates: { lat: number, lng: number },
  
  // Property details
  size: number, // m²
  rooms: number,
  type: "room" | "apartment" | "house" | "commercial",
  
  // Media
  images: ["url1", "url2"],
  
  // Metadata
  url: "original_listing_url",
  firstSeen: timestamp,
  lastSeen: timestamp,
  isActive: boolean,
  scrapedAt: timestamp,
  
  // Source-specific data
  sourceData: {} // Platform-specific additional fields
}
```

## 🚀 **Implementation Plan**

### **Phase 1: Restructure Existing Code**
1. Move current Kleinanzeigen logic to `scrapers/kleinanzeigen/`
2. Create unified API in `api/` directory
3. Implement data normalizer for consistent schema

### **Phase 2: Add WG-gesucht Integration**
1. Implement WG-gesucht API client
2. Create fallback scraper for edge cases
3. Add to orchestrator for coordinated scraping

### **Phase 3: Enhanced Features**
1. Implement advanced filtering across sources
2. Add duplicate detection across platforms
3. Create notification system for new listings

## 🎯 **Benefits of This Architecture**

- **🔧 Modular**: Each scraper is independent
- **📈 Scalable**: Easy to add new sources
- **🛡️ Resilient**: If one source fails, others continue
- **🔄 Flexible**: Can switch between API/scraping per source
- **📊 Unified**: Single API for all rental data
- **🚀 Fast**: Parallel processing of multiple sources

## 🔧 **Technology Stack**

- **API**: Express.js + Node.js
- **Database**: Firebase Firestore
- **Scrapers**: Puppeteer (Kleinanzeigen) + Axios (WG-gesucht API)
- **Scheduling**: node-cron
- **Deployment**: Firebase Functions
- **Monitoring**: Firebase Analytics + Custom logging

This architecture ensures the project can grow to include any number of rental platforms while maintaining clean, maintainable code. 