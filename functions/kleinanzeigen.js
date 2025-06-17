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

    // Try multiple URL formats to find the correct one
    const urlFormats = [
      `https://www.kleinanzeigen.de/s-anzeige/item/${itemId}`,
      `https://www.kleinanzeigen.de/s-anzeige/nachmieter/${itemId}`,
      `https://www.kleinanzeigen.de/s-anzeige/wohnung/${itemId}`,
    ];

    let itemDetails = null;
    let successfulUrl = null;

    for (const url of urlFormats) {
      try {
        console.log(`🔍 Trying URL format: ${url}`);

        await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
        await page.waitForTimeout(1500);

        // Check if page loaded successfully (not 404 or error)
        const pageTitle = await page.title();
        if (
          pageTitle.toLowerCase().includes("nicht gefunden") ||
          pageTitle.toLowerCase().includes("404") ||
          pageTitle.toLowerCase().includes("fehler")
        ) {
          console.log(`❌ Page not found for URL: ${url}`);
          continue;
        }

        // Try to extract item details
        itemDetails = await page.evaluate(() => {
          // Multiple selectors for title
          const titleSelectors = [
            "h1#viewad-title",
            "h1[data-qa-id='aditem-title']",
            ".boxedarticle h1",
            "h1.text-module-begin",
            ".ad-title h1",
          ];

          let title = "";
          for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              title = element.textContent.trim();
              break;
            }
          }

          // Multiple selectors for description
          const descSelectors = [
            "#viewad-description-text",
            "[data-qa-id='aditem-description']",
            ".ad-description",
            ".text-module-end",
            "#ad-description",
          ];

          let description = "";
          for (const selector of descSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              description = element.textContent.trim();
              break;
            }
          }

          // Multiple selectors for price
          const priceSelectors = [
            "#viewad-price",
            "[data-qa-id='aditem-price']",
            ".ad-price",
            ".price-boxed",
            ".notranslate",
          ];

          let price = null;
          for (const selector of priceSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              const priceText = element.textContent.trim();
              const priceMatch = priceText.match(/[\d.,]+/);
              if (priceMatch) {
                price = parseInt(priceMatch[0].replace(/[.,]/g, ""));
                break;
              }
            }
          }

          // Multiple selectors for location
          const locationSelectors = [
            "#viewad-locality",
            "[data-qa-id='aditem-location']",
            ".ad-location",
            ".text-light",
            "#viewad-details .text-light",
          ];

          let location = "";
          for (const selector of locationSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              location = element.textContent.trim();
              break;
            }
          }

          // Multiple selectors for images
          const imageSelectors = [
            "#viewad-image img",
            ".galleryimage-element img",
            ".ad-image img",
            ".image-gallery img",
            "[data-qa-id='aditem-image'] img",
          ];

          let images = [];
          for (const selector of imageSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              images = Array.from(elements)
                .map((img) => img.src)
                .filter(
                  (src) =>
                    src &&
                    !src.includes("placeholder") &&
                    !src.includes("default") &&
                    src.startsWith("http")
                );
              if (images.length > 0) break;
            }
          }

          // Extract additional details
          const detailsSelectors = [
            "#viewad-details",
            ".ad-details",
            ".attributelist",
            "[data-qa-id='aditem-details']",
          ];

          let additionalDetails = {};
          for (const selector of detailsSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              const text = element.textContent;

              // Extract common details
              if (text.includes("m²") || text.includes("qm")) {
                const sizeMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m²|qm)/);
                if (sizeMatch) {
                  additionalDetails.size = parseFloat(
                    sizeMatch[1].replace(",", ".")
                  );
                }
              }

              if (text.includes("Zimmer")) {
                const roomMatch = text.match(/(\d+(?:[.,]\d+)?)\s*Zimmer/);
                if (roomMatch) {
                  additionalDetails.rooms = parseFloat(
                    roomMatch[1].replace(",", ".")
                  );
                }
              }

              break;
            }
          }

          // Get posting date
          let postedDate = null;
          const dateSelectors = [
            "#viewad-extra-info",
            ".ad-date",
            ".creation-date",
          ];

          for (const selector of dateSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              const dateText = element.textContent;
              if (
                dateText.includes("Erstellt am") ||
                dateText.includes("Online seit")
              ) {
                // Try to extract date
                const dateMatch = dateText.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
                if (dateMatch) {
                  postedDate = dateMatch[1];
                  break;
                }
              }
            }
          }

          return {
            title,
            description,
            price,
            currency: "EUR",
            location,
            images: images.slice(0, 10), // Limit to 10 images
            additionalDetails,
            postedDate,
            hasContent: !!(title || description || price || location),
          };
        });

        // Check if we got meaningful content
        if (itemDetails && itemDetails.hasContent) {
          successfulUrl = url;
          console.log(`✅ Successfully extracted details from: ${url}`);
          break;
        } else {
          console.log(`❌ No meaningful content found at: ${url}`);
        }
      } catch (urlError) {
        console.log(`❌ Failed to load URL ${url}:`, urlError.message);
        continue;
      }
    }

    if (!itemDetails || !itemDetails.hasContent) {
      throw new Error(
        `Could not fetch details for item ${itemId} - tried ${urlFormats.length} URL formats`
      );
    }

    // Remove the hasContent flag before returning
    delete itemDetails.hasContent;

    console.log(`✅ Item details fetched successfully from: ${successfulUrl}`);
    console.log(`   📋 Title: ${itemDetails.title ? "Found" : "Missing"}`);
    console.log(
      `   📝 Description: ${itemDetails.description ? "Found" : "Missing"}`
    );
    console.log(
      `   💰 Price: ${
        itemDetails.price ? itemDetails.price + " EUR" : "Missing"
      }`
    );
    console.log(
      `   📍 Location: ${itemDetails.location ? "Found" : "Missing"}`
    );
    console.log(
      `   🖼️  Images: ${itemDetails.images ? itemDetails.images.length : 0}`
    );

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
