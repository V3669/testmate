const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const path = require('path');

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
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Testmate Web Server listening on port 3000');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

start();
