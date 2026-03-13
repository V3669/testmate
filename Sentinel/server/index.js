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
    mcp.tool(
        "run_functional_tests",
        "Run functional tests defined in tests.json. Use configPath to specify a custom tests.json location.",
        { 
            tag: { type: "string" }, 
            id: { type: "string" },
            configPath: { type: "string", description: "Path to custom tests.json file" }
        },
        async ({ tag, id, configPath }) => {
            // Reload config if custom path provided
            if (configPath) {
                console.log(`[Testmate] Using custom config: ${configPath}`);
                service.configLoader.configPath = configPath;
                service.configLoader.load();
            }
            
            try {
                await open('http://localhost:3000');
            } catch (e) { console.error(e); }

            const results = await service.runFunctionalTests(id);
            return {
                content: [{
                    type: "text",
                    text: `Dashboard on http://localhost:3000\n\n${JSON.stringify(results, null, 2)}`
                }]
            };
        }
    );

    mcp.tool(
        "run_stress_simulation",
        "Run stress simulation. Use configPath to specify a custom tests.json file.",
        { 
            scenarioId: { type: "string", required: true },
            configPath: { type: "string", description: "Path to custom tests.json file" }
        },
        async ({ scenarioId, configPath }) => {
            // Reload config if custom path provided
            if (configPath) {
                console.log(`[Testmate] Using custom config: ${configPath}`);
                service.configLoader.configPath = configPath;
                service.configLoader.load();
            }
            
            try {
                await open('http://localhost:3000');
            } catch (e) { console.error(e); }

            const result = await service.runStressTest(scenarioId);
            return {
                content: [{
                    type: "text",
                    text: `Stress Test started.\n\n${JSON.stringify(result, null, 2)}`
                }]
            };
        }
    );

    mcp.tool(
        "get_test_results",
        "Get latest test results.",
        {},
        async () => {
            const state = service.getState();
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({ functional: state.testResults, stress: state.stressResults }, null, 2)
                }]
            }
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
            return {
                content: [{
                    type: "text",
                    text: `Config set to: ${configPath}\n\nLoaded ${config?.scenarios?.length || 0} scenarios`
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
