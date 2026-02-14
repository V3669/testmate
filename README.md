# Testmate

A personal development workflow assistant I'm building to streamline the entire development-to-testing process right from the IDE.

Testmate acts as a central hub that combines multiple tools to make development and testing seamless, with your IDE becoming the one-stop shop for everything.

## Quick start

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The server will start running on `http://localhost:3000`.

## Components

### Sentinel - Testing from your IDE

Sentinel is the testing component of Testmate that lets you create and run tests without leaving your IDE. Using AI agents directly in your editor, you can:

- Generate test cases automatically based on your code
- Run functional and stress tests
- Get real-time feedback on test results
- Manage test suites through a web interface

Sentinel makes testing feel like a natural part of coding rather than a separate chore.

### Mock Service (Coming Next)

I'm working on a mock data service that will help developers test various scenarios by mocking external dependencies and APIs. This will be another MCP tool that:

- Mocks API responses for different scenarios
- Simulates external service failures
- Provides realistic test data
- Works seamlessly with your local development environment

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
