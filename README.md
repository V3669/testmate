# Testmate

A personal development workflow assistant that streamlines the entire development-to-testing process right from your IDE.

## Features

- **AI-Powered Testing**: Generate and run test cases directly from your IDE using AI agents
- **Functional Testing**: Test your API logic with detailed assertions and diff views
- **Stress Testing**: Load test your endpoints with configurable concurrency and duration
- **Real-time Metrics**: View p50, p95, p99 latency metrics and throughput stats
- **MCP Integration**: Connect with Cursor, Windsurf, Anti-Gravity, or any MCP-compatible IDE
- **Hot Reload**: Tests auto-run when you update your test configuration

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Server runs at **http://localhost:3000**

## MCP Setup

### For Cursor/Windsurf/VSCode

Add to your MCP config (usually `~/.cursor/mcp.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "testmate": {
      "command": "node",
      "args": ["/path/to/testmate/gateway.js"]
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `run_functional_tests` | Run functional tests from tests.json |
| `run_stress_simulation` | Run stress test on a specific scenario |
| `get_test_results` | Get latest test results with metrics |

## Configuration

Edit `tests.json` to define your test scenarios:

```json
{
  "config": {
    "baseUrl": "http://localhost:8080",
    "globalHeaders": { "Authorization": "Bearer {{env.API_KEY}}" },
    "timeout": 5000
  },
  "scenarios": [
    {
      "id": "health_check",
      "type": "functional",
      "method": "GET",
      "endpoint": "/health",
      "expect": {
        "status": 200,
        "bodyPartial": { "status": "ok" }
      }
    },
    {
      "id": "stress_users",
      "type": "stress",
      "targetScenarioId": "create_user",
      "parameters": {
        "connections": 50,
        "duration": "10s",
        "pipelining": 1
      },
      "thresholds": {
        "p95": 200,
        "errors": 0.01
      }
    }
  ]
}
```

### Environment Variables

Use `{{env.VAR_NAME}}` in your config for environment variables:

```json
{
  "config": {
    "baseUrl": "{{env.API_URL}}",
    "globalHeaders": {
      "Authorization": "Bearer {{env.API_KEY}}"
    }
  },
  "env": {
    "API_URL": "http://localhost:3000",
    "API_KEY": "your-key-here"
  }
}
```

## Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start web server (http://localhost:3000) |
| `npm run mcp` | Start MCP gateway for IDE integration |
| `npm run dev` | Run both server and client in dev mode |
| `npm test` | Run all tests |
| `npm run build` | Build the client |

## Project Structure

```
testmate/
├── gateway.js           # MCP server entry point
├── web-server.js       # HTTP server entry point
├── tests.json          # Test configuration
├── package.json        # Root dependencies
├── Sentinel/
│   ├── client/         # React UI dashboard
│   │   ├── src/
│   │   └── dist/      # Built static files
│   └── server/        # Core testing engine
│       ├── SentinelService.js
│       ├── functionalRunner.js
│       ├── stressRunner.js
│       ├── configLoader.js
│       └── tests/
└── README.md
```

## Testing

Run all tests:
```bash
npm test
```

Run with coverage:
```bash
npm run test:coverage
```

## Tech Stack

- **Fastify** - Web server framework
- **MCP SDK** - Model Context Protocol
- **React** - UI dashboard
- **Autocannon** - Load testing
- **Jest** - Testing framework
- **WebSocket** - Real-time updates

## License

ISC
