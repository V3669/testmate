const fastify = require('fastify')({ logger: false });
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const cors = require('@fastify/cors');
const path = require('path');

// IMPORTANT: MCP stdio uses stdout for the protocol. Writing logs to stdout can break the handshake.
// Route logs to stderr in this process.
console.log = console.error;

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

        // Support custom config path via env var
        const options = {};
        if (process.env.TESTMATE_CONFIG) {
            options.configPath = process.env.TESTMATE_CONFIG;
            console.log(`[Testmate] Using config: ${options.configPath}`);
        }

        // Check if plugin exports a setup function
        if (typeof sentinelPlugin.setup === 'function') {
            await sentinelPlugin.setup(mcpServer, fastify, options);
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

    // Start MCP only (web server is handled separately)
    try {
        const transport = new StdioServerTransport();
        await mcpServer.connect(transport);
        console.log("Testmate MCP Gateway connected via Stdio");
    } catch (err) {
        console.error("Failed to connect MCP transport:", err);
        process.exit(1);
    }
}

start();
