// Scraper module for eBay Kleinanzeigen
// This module is cleanly separated from the API layer

const puppeteer = require("puppeteer");
const fs = require("fs");

// Helper to build the search URL
function buildSearchUrl(params) {
  const baseUrl = "https://www.kleinanzeigen.de/s-anzeige:angebote";
  const urlParams = new URLSearchParams();

  if (params.query) {
    urlParams.append("keywords", params.query);
  }

  if (params.location) {
    urlParams.append("locationStr", params.location);
  }

  if (params.radius) {
    urlParams.append("radius", params.radius.toString());
  }

  if (params.minPrice) {
    urlParams.append("priceType", "FIXED");
    urlParams.append("minPrice", params.minPrice.toString());
  }

  if (params.maxPrice) {
    urlParams.append("priceType", "FIXED");
    urlParams.append("maxPrice", params.maxPrice.toString());
  }

  if (params.offset && params.offset > 0) {
    urlParams.append("pageNum", Math.floor(params.offset / 20) + 1);
  }

  return `${baseUrl}?${urlParams.toString()}`;
}

function extractItemId(url) {
  const patterns = [
    /\/s-anzeige\/[^\/]+\/(\d+)-/,
    /anzeige[:\-](\d+)/i,
    /id[=:](\d+)/i,
    /\/(\d{8,})[\/\-]/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `generated_${timestamp}_${randomSuffix}`;
}

async function searchItems(params) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const url = buildSearchUrl(params);
    console.log("🔍 Scraping URL:", url);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForTimeout(2000);

    const items = await page.evaluate(() => {
      const articles = document.querySelectorAll(
        "article[data-adid], article.aditem"
      );
      return Array.from(articles)
        .map((article) => {
          try {
            const titleElement = article.querySelector(
              'h2 a, .aditem-main--top--title a, [data-qa-id="aditem-title"] a'
            );
            const title = titleElement?.textContent?.trim() || "";

            const linkElement = titleElement;
            const relativeUrl = linkElement?.getAttribute("href") || "";
            const fullUrl = relativeUrl.startsWith("http")
              ? relativeUrl
              : `https://www.kleinanzeigen.de${relativeUrl}`;

            const priceElement = article.querySelector(
              '.aditem-main--middle--price-shipping--price, [data-qa-id="aditem-price"]'
            );
            let price = null;
            let currency = "EUR";

            if (priceElement) {
              const priceText = priceElement.textContent.trim();
              const priceMatch = priceText.match(/[\d.,]+/);
              if (priceMatch) {
                price = parseInt(priceMatch[0].replace(/[.,]/g, ""));
              }
            }

            const descElement = article.querySelector(
              '.aditem-main--middle--description, [data-qa-id="aditem-description"]'
            );
            const description = descElement?.textContent?.trim() || "";

            const locationElement = article.querySelector(
              '.aditem-main--top--left, [data-qa-id="aditem-location"]'
            );
            const location = locationElement?.textContent?.trim() || "";

            const imageElement = article.querySelector("img");
            const images = imageElement?.src ? [imageElement.src] : [];

            const createdAt = new Date().toISOString();

            return {
              title,
              description,
              price,
              currency,
              location,
              distance: null,
              images,
              url: fullUrl,
              createdAt,
              seller: {
                name: "",
                rating: null,
                memberSince: "",
              },
            };
          } catch (error) {
            console.error("Error parsing article:", error);
            return null;
          }
        })
        .filter((item) => item && item.title);
    });

    const itemsWithIds = items.map((item) => ({
      ...item,
      id: extractItemId(item.url),
    }));

    console.log(`✅ Found ${itemsWithIds.length} items`);
    return itemsWithIds.slice(0, params.limit || 20);
  } catch (error) {
    console.error("❌ Scraping failed:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function getItemDetails(itemId) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const url = `https://www.kleinanzeigen.de/s-anzeige/item/${itemId}-999-9999`;
    console.log("🔍 Fetching item details:", url);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForTimeout(2000);

    const itemDetails = await page.evaluate(() => {
      const title =
        document.querySelector("h1#viewad-title")?.textContent?.trim() || "";
      const description =
        document
          .querySelector("#viewad-description-text")
          ?.textContent?.trim() || "";

      const priceElement = document.querySelector("#viewad-price");
      let price = null;
      if (priceElement) {
        const priceMatch = priceElement.textContent.match(/[\d.,]+/);
        if (priceMatch) {
          price = parseInt(priceMatch[0].replace(/[.,]/g, ""));
        }
      }

      const locationElement = document.querySelector("#viewad-locality");
      const location = locationElement?.textContent?.trim() || "";

      const images = Array.from(
        document.querySelectorAll(
          "#viewad-image img, .galleryimage-element img"
        )
      )
        .map((img) => img.src)
        .filter((src) => src && !src.includes("placeholder"));

      const createdElement = document.querySelector("#viewad-extra-info");
      const createdAt = createdElement?.textContent?.includes("Erstellt am")
        ? new Date().toISOString()
        : new Date().toISOString();

      return {
        title,
        description,
        price,
        currency: "EUR",
        location,
        images,
        createdAt,
      };
    });

    console.log("✅ Item details fetched successfully");
    return itemDetails;
  } catch (error) {
    console.error("❌ Failed to fetch item details:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = {
  searchItems,
  getItemDetails,
};
