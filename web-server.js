const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const path = require('path');

// Get port from environment or default to 3000
const PORT = process.env.PORT || process.env.TESTMATE_PORT || 3000;

// Initialize Core Systems
fastify.register(cors, {
    origin: true
});

// Plugin Loader
async function loadPlugins() {
    try {
        console.log("Loading Sentinel plugin...");
        const sentinelPlugin = require('./Sentinel/server/index.js');

        // Check if plugin exports a setup function
        if (typeof sentinelPlugin.setup === 'function') {
            await sentinelPlugin.setup(null, fastify); // Pass null for MCP since we don't need it in web mode
            console.log("Sentinel plugin loaded successfully.");
        } else {
            console.error("Sentinel plugin does not export a setup function.");
        }
    } catch (err) {
        console.error("Failed to load Sentinel plugin:", err);
    }
}

// Start Web Server
async function start() {
    await loadPlugins();

    // Start Fastify
    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`Testmate Web Server listening on port ${PORT}`);
        console.log(`Testmate UI: http://localhost:${PORT}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

start();
