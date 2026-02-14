# Testmate

A lightweight gateway server for managing and coordinating various testing tools and plugins.

## What it does

Testmate acts as a central hub that:
- Runs a web server on port 3000
- Loads and manages testing plugins (like Sentinel)
- Provides MCP (Model Context Protocol) integration
- Handles cross-origin requests for web-based testing interfaces

## Quick start

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The server will start running on `http://localhost:3000`.

## Project structure

- `gateway.js` - Main server entry point
- `Sentinel/` - Testing plugin for code verification
- `package.json` - Dependencies and scripts

## Testing

Run tests with:
```bash
npm test
```

## Dependencies

- Fastify - Web server framework
- MCP SDK - Model Context Protocol integration
- WebSocket support for real-time communication
