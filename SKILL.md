---
name: testmate
description: |
  Run functional and stress tests against any API endpoint. 
  Use for: API testing, endpoint validation, load testing, performance metrics, 
  p50/p95/p99 latency checks, health checks, integration testing.
  Triggers: test API, run tests, load test, stress test, check endpoint, 
  verify response, measure latency, performance test, health check
---

# Testmate - AI-Powered API Testing

Testmate enables AI agents to run functional and stress tests against local APIs directly from your IDE.

## Quick Start

```bash
npm install
npm start
```

Server runs at **http://localhost:3000**

## MCP Configuration

Add to your MCP config (`~/.cursor/mcp.json` or project `.mcp.json`):

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

## Available Tools

### run_tests (Recommended)

Primary tool for running tests. Parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | No | "functional", "stress", or "all" |
| `scenarioId` | string | No | Specific test ID to run |
| `workingDirectory` | string | No | Path to your project |
| `configPath` | string | No | Full path to tests.json |

### Other Tools

- `get_config_info` - Show current config and status
- `get_test_results` - Get latest test results
- `set_config_path` - Switch to different project

## Usage Examples

### Basic Usage

```javascript
// Run all functional tests
run_tests({ type: "functional" })

// Run stress test
run_tests({ type: "stress", scenarioId: "load_test" })

// Run specific test
run_tests({ scenarioId: "health_check" })
```

### Testing Your Project

```javascript
// Use workingDirectory to specify your project
run_tests({ 
  type: "functional", 
  workingDirectory: "/Users/vigi/Desktop/lexicon" 
})

// Or use configPath for specific file
run_tests({ 
  configPath: "/Users/vigi/Desktop/lexicon/tests.json" 
})

// Run stress test on your project
run_tests({ 
  type: "stress", 
  scenarioId: "webinar_stress",
  workingDirectory: "/Users/vigi/Desktop/lexicon" 
})
```

## Configuration File

Create `tests.json` in your project:

```json
{
  "config": {
    "baseUrl": "http://localhost:6001",
    "globalHeaders": { "Authorization": "Bearer {{env.API_KEY}}" },
    "timeout": 15000
  },
  "scenarios": [
    {
      "id": "health_check",
      "type": "functional",
      "method": "GET",
      "endpoint": "/health",
      "expect": { "status": 200 }
    },
    {
      "id": "create_user",
      "type": "functional", 
      "method": "POST",
      "endpoint": "/users",
      "body": { "name": "Test" },
      "expect": { "status": 201, "bodyPartial": { "id": "*" } }
    },
    {
      "id": "load_test",
      "type": "stress",
      "targetScenarioId": "create_user",
      "parameters": { "connections": 10, "duration": "10s" },
      "thresholds": { "p95": 500, "errors": 0.01 }
    }
  ]
}
```

## Wildcard Matching

Use `*` in bodyPartial to match any value:

```json
{ "bodyPartial": { "id": "*", "name": "Test" } }
```

## Environment Variables

```json
{
  "config": {
    "baseUrl": "{{env.API_URL}}"
  },
  "env": {
    "API_URL": "http://localhost:3000"
  }
}
```

## Test Types

### Functional Tests
- Test API logic and responses
- Assert status codes and body content
- Support wildcards for dynamic values

### Stress Tests  
- Load test with concurrent connections
- Measure p50, p95, p99 latency
- Track RPS (requests per second)
- Verify error rates under load

## Example Prompts

```
"Run tests against our API at localhost:6001"
"Load test the /users endpoint with 50 connections"
"Verify the health endpoint returns 200"
"Check if the webhook endpoint responds correctly"
"Run our full test suite"
"Test the login API with invalid credentials"
```

## Troubleshooting

If tests don't run against your project:

```javascript
// Explicitly specify working directory
run_tests({ 
  workingDirectory: "/full/path/to/your/project" 
})

// Check current config
get_config_info()
```

## Project Structure

```
testmate/
├── gateway.js        # MCP server
├── web-server.js     # HTTP server  
├── tests.json        # Default config
├── SKILL.md          # This file
└── Sentinel/
    ├── client/       # UI
    └── server/       # Engine
```
