const SentinelService = require('./SentinelService');
const fastify = require('fastify');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

describe('Sentinel Integration', () => {
    let server;
    let service;
    let configPath;
    let port;

    beforeAll(async () => {
        // Start a mock server
        server = fastify();

        server.get('/health', async (request, reply) => {
            return { status: 'ok', timestamp: new Date().toISOString() };
        });

        server.post('/echo', async (request, reply) => {
            return request.body;
        });

        await server.listen({ port: 0 }); // Random port
        port = server.server.address().port;

        console.log(`Test server listening on ${port}`);
    });

    afterAll(async () => {
        if (server) await server.close();
        if (configPath && fs.existsSync(configPath)) fs.unlinkSync(configPath);
    });

    test('should run functional tests against real server', async () => {
        // Create config file
        const config = {
            config: {
                baseUrl: `http://localhost:${port}`,
                timeout: 1000
            },
            scenarios: [
                {
                    id: 'health-check',
                    type: 'functional',
                    method: 'GET',
                    endpoint: '/health',
                    expect: {
                        status: 200,
                        bodyPartial: { status: 'ok' }
                    }
                },
                {
                    id: 'echo-check',
                    type: 'functional',
                    method: 'POST',
                    endpoint: '/echo',
                    body: { message: 'hello' },
                    expect: {
                        status: 200,
                        bodyPartial: { message: 'hello' }
                    }
                }
            ]
        };

        configPath = path.join(os.tmpdir(), `sentinel-integration-${Date.now()}.json`);
        fs.writeFileSync(configPath, JSON.stringify(config));

        service = new SentinelService(configPath);

        // Wait for config load? 
        // SentinelService constructor creates loader but doesn't auto-load?
        // Wait, SentinelService constructor: `this.configLoader = new ConfigLoader(configPath);`
        // ConfigLoader constructor doesn't load.
        // SentinelService.runFunctionalTests() calls getConfig().
        // Does ConfigLoader auto-load? 
        // ConfigLoader.js:
        // class ConfigLoader { constructor() { ... } load() { ... } startWatching() { ... this.load() } }
        // So constructor does NOT load.
        // But SentinelService DOES NOT call load() in constructor.
        // SentinelService only calls `startWatching` in `start()`.
        // If we call `runFunctionalTests` without `start()`, `getConfig` returns null!

        // Wait, `SentinelService.js` line 52 checks `!config`.

        // So we MUST call `service.start()` or manually trigger load.
        // Or SentinelService should load on init?

        // Let's call start()
        service.start();

        // Give time for initial load (sync read in ConfigLoader usually, but triggered by startWatching)
        await sleep(100);

        const results = await service.runFunctionalTests();

        expect(results).toBeDefined();
        expect(results['health-check']).toBeDefined();
        expect(results['health-check'].status).toBe('passed');
        expect(results['echo-check'].status).toBe('passed');
    });
});
