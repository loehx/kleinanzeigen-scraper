// Main entry point - now delegates to the unified API server
const app = require("./api/server");

// The server is already started in api/server.js
console.log("🚀 Multi-Source Rental Aggregator started via index.js");

// Export the app for testing purposes
module.exports = app;
