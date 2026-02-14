const fastify = require('fastify')({ logger: true });
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const cors = require('@fastify/cors');
const path = require('path');

// Initialize Core Systems
const mcpServer = new McpServer({
    name: "Testmate Gateway",
    version: "1.0.0"
});

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
            await sentinelPlugin.setup(mcpServer, fastify);
            console.log("Sentinel plugin loaded successfully.");
        } else {
            console.error("Sentinel plugin does not export a setup function.");
        }
    } catch (err) {
        console.error("Failed to load Sentinel plugin:", err);
    }
}

// Start Server
async function start() {
    await loadPlugins();

    // Start Fastify
    try {
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Testmate Gateway listening on port 3000');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }

    // Start MCP
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.log("Testmate MCP Gateway connected via Stdio");
}

start();
