// Scraper module for eBay Kleinanzeigen
// This module is cleanly separated from the API layer

const puppeteer = require("puppeteer");
const fs = require("fs");

// Helper to build the search URL
function buildSearchUrl({
  query = "",
  location = "",
  category = "",
  minPrice = "",
  maxPrice = "",
  radius = "",
  offset = 0,
}) {
  // Try the standard search URL format
  let url = "https://www.kleinanzeigen.de/s-anzeige:angebote";

  let params = new URLSearchParams();

  if (query) params.append("keywords", query);
  if (location) params.append("locationStr", location);
  if (category) params.append("categoryId", category);
  if (minPrice) params.append("minPrice", minPrice);
  if (maxPrice) params.append("maxPrice", maxPrice);
  if (radius) params.append("radius", radius);
  if (offset > 0) params.append("pageNum", offset + 1);

  if (params.toString()) {
    url += "?" + params.toString();
  }

  console.log("[Scraper] Generated URL:", url);
  return url;
}

async function searchItems(params) {
  const url = buildSearchUrl(params);
  console.log("[Scraper] Fetching:", url);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Navigate with retry logic
    let navigationSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
        navigationSuccess = true;
        break;
      } catch (navErr) {
        console.log(
          `[Scraper] Navigation attempt ${attempt} failed:`,
          navErr.message
        );
        if (attempt === 3) throw navErr;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!navigationSuccess) {
      throw new Error("Failed to navigate after 3 attempts");
    }

    // Wait for content to load
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      await page.waitForSelector("article", { timeout: 15000 });
    } catch (waitErr) {
      console.error(
        "[Scraper] Selector not found, saving screenshot and HTML..."
      );
      await page.screenshot({ path: "scraper_error.png" });
      const html = await page.content();
      fs.writeFileSync("scraper_error.html", html);
      throw waitErr;
    }

    const items = await page.evaluate((limit) => {
      const nodes = Array.from(document.querySelectorAll("article")).slice(
        0,
        limit
      );
      return nodes.map((node) => {
        // Title and URL
        const titleEl =
          node.querySelector("h2 a") ||
          node.querySelector('[data-qa-id="aditem-title"] a') ||
          node.querySelector('a[href*="/s-anzeige/"]');
        const title = titleEl ? titleEl.innerText.trim() : "";
        const url = titleEl ? titleEl.href : "";

        // Price - try multiple selectors
        const priceEl =
          node.querySelector('[data-qa-id="aditem-price"]') ||
          node.querySelector(".aditem-main--middle--price") ||
          node.querySelector(".price") ||
          node.querySelector('[class*="price"]');
        let priceText = "";
        if (priceEl) {
          priceText = priceEl.innerText
            .replace(/[^\d,.€]/g, "")
            .replace(",", ".");
        }
        const price =
          priceText && priceText.length > 0 ? parseFloat(priceText) : null;
        const currency = price ? "EUR" : "";

        // Location - try multiple selectors
        const locationEl =
          node.querySelector('[data-qa-id="aditem-location"]') ||
          node.querySelector(".aditem-main--top--left") ||
          node.querySelector('[class*="location"]') ||
          node.querySelector(".text-module-begin");
        const location = locationEl ? locationEl.innerText.trim() : "";

        // Description - try multiple selectors
        const descEl =
          node.querySelector('[data-qa-id="aditem-description"]') ||
          node.querySelector(".aditem-main--middle--description") ||
          node.querySelector(".text-module-end") ||
          node.querySelector("p");
        const description = descEl ? descEl.innerText.trim() : "";

        // Image
        const imgEl = node.querySelector("img");
        const image = imgEl ? imgEl.src : "";

        // Extract ID from URL with improved regex patterns
        let id = "";
        if (url) {
          const idMatch =
            url.match(/\/(\d+)-\d+-\d+$/) ||
            url.match(/anzeige\/[^\/]+\/(\d+)-/) ||
            url.match(/(\d{10,})/) ||
            url.match(/\/(\d+)$/);
          id = idMatch ? idMatch[1] : "";
        }

        // Generate fallback ID if none found
        if (!id) {
          id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        }

        return {
          id,
          title,
          description,
          price,
          currency,
          location,
          distance: null,
          images: image ? [image] : [],
          url,
          createdAt: new Date().toISOString(),
          seller: {
            name: "",
            rating: null,
            memberSince: "",
          },
        };
      });
    }, params.limit || 20);

    await browser.close();
    return items;
  } catch (err) {
    console.error("[Scraper] Error:", err);
    if (browser) await browser.close();
    throw err;
  }
}

async function getItemDetails(itemId) {
  // Simple URL format: the description and trailing numbers don't matter
  const url = `https://www.kleinanzeigen.de/s-anzeige/item/${itemId}-999-9999`;
  console.log("[Scraper] Fetching item details:", url);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Navigate to the item page
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const itemDetails = await page.evaluate(() => {
      // Title
      const titleEl =
        document.querySelector("h1") ||
        document.querySelector('[data-qa="aditem-title"]');
      const title = titleEl ? titleEl.innerText.trim() : "";

      // Price
      const priceEl =
        document.querySelector('[data-qa="aditem-price"]') ||
        document.querySelector(".boxedarticle--price") ||
        document.querySelector('[class*="price"]');
      let priceText = "";
      if (priceEl) {
        priceText = priceEl.innerText
          .replace(/[^\d,.€]/g, "")
          .replace(",", ".");
      }
      const price =
        priceText && priceText.length > 0 ? parseFloat(priceText) : null;
      const currency = price ? "EUR" : "";

      // Description
      const descEl =
        document.querySelector('[data-qa="aditem-description"]') ||
        document.querySelector(".boxedarticle--description") ||
        document.querySelector("#viewad-description-text");
      const description = descEl ? descEl.innerText.trim() : "";

      // Location
      const locationEl =
        document.querySelector('[data-qa="aditem-location"]') ||
        document.querySelector(".boxedarticle--details") ||
        document.querySelector("#viewad-locality");
      const location = locationEl ? locationEl.innerText.trim() : "";

      // Images
      const imageEls =
        document.querySelectorAll(".galleryimage-element img") ||
        document.querySelectorAll(".imagegallery img") ||
        document.querySelectorAll('img[src*="kleinanzeigen"]');
      const images = Array.from(imageEls)
        .map((img) => img.src)
        .filter((src) => src && src.includes("kleinanzeigen"));

      // Seller information
      const sellerNameEl =
        document.querySelector('[data-qa="aditem-seller-name"]') ||
        document.querySelector(".userprofile--name") ||
        document.querySelector("#viewad-contact-name");
      const sellerName = sellerNameEl ? sellerNameEl.innerText.trim() : "";

      const memberSinceEl =
        document.querySelector('[data-qa="aditem-seller-since"]') ||
        document.querySelector(".userprofile--since");
      const memberSince = memberSinceEl ? memberSinceEl.innerText.trim() : "";

      // Created date
      const createdEl =
        document.querySelector('[data-qa="aditem-creation-date"]') ||
        document.querySelector(".boxedarticle--details-datetime") ||
        document.querySelector("#viewad-extra-info");
      const createdAt = createdEl
        ? createdEl.innerText.trim()
        : new Date().toISOString();

      // Additional details
      const detailsEls =
        document.querySelectorAll(".attributelist li") ||
        document.querySelectorAll(".boxedarticle--details-list li");
      const attributes = {};
      Array.from(detailsEls).forEach((el) => {
        const text = el.innerText.trim();
        if (text.includes(":")) {
          const [key, value] = text.split(":").map((s) => s.trim());
          attributes[key] = value;
        }
      });

      return {
        title,
        description,
        price,
        currency,
        location,
        images,
        createdAt,
        attributes,
        seller: {
          name: sellerName,
          rating: null,
          memberSince,
        },
      };
    });

    await browser.close();
    return {
      id: itemId,
      url: url,
      ...itemDetails,
    };
  } catch (err) {
    console.error("[Scraper] Error fetching item details:", err);
    if (browser) await browser.close();
    throw err;
  }
}

module.exports = {
  searchItems,
  getItemDetails,
};
