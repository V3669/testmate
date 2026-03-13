---
name: testmate
description: |
  Testmate is an AI-powered testing framework that runs functional and stress tests against local APIs. 
  Use when user wants to: generate tests, run API tests, load test endpoints, check API performance metrics, 
  test against localhost APIs, verify API responses, or measure p50/p95/p99 latency.
  Works with tests.json config file in the project.
  Trigger keywords: test, API, endpoint, load, stress, performance, latency, p95, health check, integration test
---

# Testmate - AI-Powered API Testing

Testmate enables AI agents to run functional and stress tests against local APIs directly from your IDE.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
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

## Available MCP Tools

| Tool | Parameters | Description |
|------|------------|-------------|
| `run_functional_tests` | `id?` (optional) | Run functional tests from tests.json |
| `run_stress_simulation` | `scenarioId` (required) | Run stress test on specific scenario |
| `get_test_results` | none | Get latest test results with metrics |

## Configuration File

Create `tests.json` in your project root:

```json
{
  "config": {
    "baseUrl": "http://localhost:8080",
    "globalHeaders": {
      "Authorization": "Bearer {{env.API_KEY}}"
    },
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
      "id": "create_user",
      "type": "functional",
      "method": "POST",
      "endpoint": "/users",
      "body": { "name": "Test", "role": "admin" },
      "expect": {
        "status": 201,
        "bodyPartial": { "id": "*", "name": "Test" }
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

## Environment Variables

Use `{{env.VAR_NAME}}` syntax:

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
    "API_KEY": "your-token"
  }
}
```

## Wildcard Matching

Use `*` in `bodyPartial` to match any value:

```json
{
  "expect": {
    "bodyPartial": {
      "id": "*",
      "name": "Test"
    }
  }
}
```

## Stress Test Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `connections` | Number of concurrent users | 10 |
| `duration` | Test duration (e.g., "10s", "1m") | 10 |
| `pipelining` | Number of pipelined requests | 1 |

## Threshold Options

| Threshold | Description | Failure Condition |
|-----------|-------------|------------------|
| `p95` | 95th percentile latency (ms) | > threshold |
| `errors` | Error rate (0-1) | > threshold |

## Example Usage

### Run all functional tests
```
Use testmate run_functional_tests to verify all endpoints work correctly
```

### Run specific test
```
Use testmate run_functional_tests with id="health_check" to test the health endpoint
```

### Run stress test
```
Use testmate run_stress_simulation with scenarioId="stress_users" to load test the users endpoint
```

### Get results
```
Use testmate get_test_results to retrieve the latest test metrics
```

## Viewing Results

- **Web UI**: Open http://localhost:3000
- **Real-time**: WebSocket updates show test progress
- **Metrics**: p50, p95, p99 latency, RPS, error rates

## Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start web server |
| `npm run mcp` | Start MCP gateway |
| `npm test` | Run tests |
| `npm run build` | Build client |

## Project Structure

```
testmate/
├── gateway.js           # MCP server
├── web-server.js        # HTTP server
├── tests.json           # Test config
├── Sentinel/
│   ├── client/          # React UI
│   └── server/          # Test engine
└── SKILL.md             # This file
```
