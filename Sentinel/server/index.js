const fastify = require('fastify')({ logger: true });
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const WebSocket = require('ws');
const path = require('path');
const cors = require('@fastify/cors');
const fastifyStatic = require('@fastify/static');
const open = require('open');

const SentinelService = require('./SentinelService');

// Exportable Setup Function (Now much cleaner)
async function setup(mcp, app, options = {}) {
    console.log("Setting up Sentinel plugin...");

    // 0. Register API endpoints for testing
    app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
    app.post('/users', async (request) => {
        const id = Math.floor(Math.random() * 1000);
        return { id, ...request.body, createdAt: new Date().toISOString() };
    });

    // 1. Initialize Service
    // Allow custom config path via options, env var, or default to CWD
    const CONFIG_PATH = options.configPath || 
                        process.env.TESTMATE_CONFIG || 
                        path.resolve(process.cwd(), 'tests.json');
    
    console.log(`[Testmate] Using config: ${CONFIG_PATH}`);
    const sentinelService = new SentinelService(CONFIG_PATH);
    sentinelService.start();

    // 2. Setup WebSocket (Transport Layer)
    const wss = new WebSocket.Server({ server: app.server });

    wss.on('connection', (ws) => {
        // Send initial state
        const state = sentinelService.getState();
        ws.send(JSON.stringify({
            type: 'init',
            ...state
        }));

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'run_test') {
                    await sentinelService.runFunctionalTests(data.id);
                }
                if (data.type === 'run_stress') {
                    await sentinelService.runStressTest(data.id);
                }
            } catch (e) {
                console.error("WS Handler Error:", e);
                ws.send(JSON.stringify({ type: 'error', message: e.message }));
            }
        });
    });

    // 3. Bind Service Events to WebSocket Broadcast
    const broadcast = (type, payload) => {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type, payload }));
            }
        });
    };

    sentinelService.on('status', p => broadcast('status', p));
    sentinelService.on('test_start', p => broadcast('test_start', p));
    sentinelService.on('test_result', p => broadcast('test_result', p));
    sentinelService.on('stress_start', p => broadcast('stress_start', p));
    sentinelService.on('stress_result', p => broadcast('stress_result', p));
    sentinelService.on('error', msg => console.error("[SentinelService]", msg));

    // 4. Register Static Files (UI)
    const distPath = path.resolve(__dirname, '../client/dist');
    try {
        await app.register(fastifyStatic, {
            root: distPath,
            prefix: '/',
        });
        app.setNotFoundHandler((req, res) => {
            res.sendFile('index.html');
        });
    } catch (err) {
        console.warn("Could not register static files (maybe dist missing?):", err.message);
    }

    // 5. Register MCP Tools
    if (mcp) {
        registerMCPTools(mcp, sentinelService);
    }

    console.log("Sentinel plugin setup complete.");
}

function registerMCPTools(mcp, service) {
    // Unified run_tests tool
    mcp.tool(
        "run_tests",
        `Run functional or stress tests from tests.json.
         - Auto-discovers tests.json in current working directory
         - Returns rich results with summary and recommendations
         - Use type='functional' for API tests, type='stress' for load tests`,
        { 
            type: { 
                type: "string", 
                enum: ["functional", "stress", "all"],
                description: "Type of tests to run: functional, stress, or all" 
            },
            scenarioId: { 
                type: "string", 
                description: "Specific test scenario ID to run (optional)" 
            },
            configPath: { 
                type: "string", 
                description: "Path to custom tests.json file (optional, defaults to CWD/tests.json)" 
            },
            workingDirectory: {
                type: "string",
                description: "Working directory to run tests from (optional)"
            }
        },
        async ({ type = "functional", scenarioId, configPath, workingDirectory }) => {
            try {
                // Update config path if provided
                if (configPath) {
                    service.configLoader.configPath = configPath;
                    service.configLoader.load();
                } else if (workingDirectory) {
                    service.configLoader.configPath = path.resolve(workingDirectory, 'tests.json');
                    service.configLoader.load();
                }
                
                const results = await service.runTests({ type, scenarioId });
                
                // Format rich response
                let text = "";
                
                if (results.error) {
                    text = `❌ Error: ${results.error.message || results.error}\n\n`;
                    if (results.error.suggestion) {
                        text += `💡 Suggestion: ${results.error.suggestion}\n\n`;
                    }
                    if (results.error.example) {
                        text += `Example tests.json:\n\`\`\`json\n${JSON.stringify(results.error.example, null, 2)}\n\`\`\``;
                    }
                    return { content: [{ type: "text", text }] };
                }
                
                if (results.summary) {
                    const { total, passed, failed, baseUrl } = results.summary;
                    const emoji = failed === 0 ? "✅" : "❌";
                    text = `${emoji} Test Results: ${passed}/${total} passed\n`;
                    text += `📁 Config: ${service.getConfigPath()}\n`;
                    text += `🌐 Testing: ${baseUrl}\n\n`;
                    
                    if (failed > 0) {
                        text += `⚠️ Failed tests:\n`;
                        for (const [id, result] of Object.entries(results.results)) {
                            if (result.status !== 'passed') {
                                text += `  - ${id}: ${result.status}\n`;
                                if (result.details?.failures) {
                                    text += `    ${result.details.failures.join(', ')}\n`;
                                }
                            }
                        }
                    }
                    
                    text += `\n📊 Details:\n\`\`\`json\n${JSON.stringify(results.results, null, 2)}\n\`\`\``;
                } else {
                    text = `Stress test completed\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\``;
                }
                
                return { content: [{ type: "text", text }] };
            } catch (err) {
                return { 
                    content: [{ 
                        type: "text", 
                        text: `❌ Error: ${err.message}\n\n💡 Make sure tests.json exists in your project root with functional and stress scenarios.` 
                    }] 
                };
            }
        }
    );

    // Legacy tools for backward compatibility
    mcp.tool(
        "run_functional_tests",
        "Run functional tests. Use run_tests instead for better results.",
        { 
            id: { type: "string" },
            configPath: { type: "string" }
        },
        async ({ id, configPath }) => {
            const result = await service.runTests({ type: 'functional', scenarioId: id, configPath });
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    mcp.tool(
        "run_stress_simulation",
        "Run stress test. Use run_tests instead for better results.",
        { 
            scenarioId: { type: "string", required: true },
            configPath: { type: "string" }
        },
        async ({ scenarioId, configPath }) => {
            const result = await service.runTests({ type: 'stress', scenarioId, configPath });
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    mcp.tool(
        "get_test_results",
        "Get latest test results with full details.",
        { format: { type: "string", enum: ["json", "summary"] } },
        async ({ format = "json" }) => {
            const state = service.getState();
            
            if (format === "summary") {
                const functional = Object.values(state.testResults);
                const stress = Object.values(state.stressResults);
                const passed = functional.filter(r => r.status === 'passed').length;
                const failed = functional.filter(r => r.status === 'failed').length;
                
                return {
                    content: [{
                        type: "text",
                        text: `Functional: ${passed} passed, ${failed} failed\nStress: ${stress.length} tests run\nConfig: ${state.configPath}`
                    }]
                };
            }
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({ 
                        functional: state.testResults, 
                        stress: state.stressResults,
                        configPath: state.configPath
                    }, null, 2)
                }]
            };
        }
    );
    
    mcp.tool(
        "set_config_path",
        "Set the path to tests.json for testing a different project.",
        { configPath: { type: "string", required: true } },
        async ({ configPath }) => {
            service.configLoader.configPath = configPath;
            service.configLoader.load();
            const config = service.getConfig();
            const error = service.getLastError();
            
            if (error) {
                return {
                    content: [{
                        type: "text",
                        text: `❌ ${error}\n\nMake sure the path is correct.`
                    }]
                };
            }
            
            return {
                content: [{
                    type: "text",
                    text: `✅ Config loaded from: ${configPath}\n\nFound ${config?.scenarios?.length || 0} test scenarios:\n${config?.scenarios?.map(s => `  - ${s.id} (${s.type})`).join('\n') || '  None'}`
                }]
            };
        }
    );
    
    mcp.tool(
        "get_config_info",
        "Get current configuration details and status.",
        {},
        async () => {
            const config = service.getConfig();
            const configPath = service.getConfigPath();
            const error = service.getLastError();
            
            if (error) {
                return {
                    content: [{
                        type: "text",
                        text: `❌ No config loaded\n\nError: ${error}\n\nExpected config at: ${configPath}\n\nExample tests.json:\n\`\`\`json\n{\n  "config": { "baseUrl": "http://localhost:3000" },\n  "scenarios": [\n    { "id": "test1", "type": "functional", "method": "GET", "endpoint": "/health" }\n  ]\n}\n\`\`\``
                    }]
                };
            }
            
            return {
                content: [{
                    type: "text",
                    text: `✅ Config loaded\n📁 Path: ${configPath}\n🌐 Base URL: ${config?.config?.baseUrl}\n⏱️ Timeout: ${config?.config?.timeout}ms\n\nScenarios (${config?.scenarios?.length}):\n${config?.scenarios?.map(s => `  - ${s.id} (${s.type}): ${s.method} ${s.endpoint}`).join('\n')}`
                }]
            };
        }
    );
}

// Standalone Execution
if (require.main === module) {
    console.log("Running in Standalone Mode");
    (async () => {
        const localFastify = require('fastify')({ logger: true });
        const localMcpServer = new McpServer({ name: "Sentinel Standalone", version: "1.0.0" });
        await localFastify.register(cors, { origin: true });

        await setup(localMcpServer, localFastify);

        try {
            await localFastify.listen({ port: 3000, host: '0.0.0.0' });
            console.log('Sentinel Server listening on port 3000');
        } catch (err) {
            localFastify.log.error(err);
            process.exit(1);
        }

        const transport = new StdioServerTransport();
        await localMcpServer.connect(transport);
    })();
}

module.exports = { setup };
