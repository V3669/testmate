const SentinelService = require('../SentinelService');
const fastify = require('fastify');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

describe('Sentinel Integration Tests', () => {
    let server;
    let service;
    let configPath;
    let port;
    let wsClient;

    beforeAll(async () => {
        server = fastify();

        server.get('/api/users', async (request, reply) => {
            return [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' }
            ];
        });

        server.post('/api/users', async (request, reply) => {
            const id = Math.floor(Math.random() * 10000);
            return { id, ...request.body, createdAt: new Date().toISOString() };
        });

        server.get('/api/slow', async (request, reply) => {
            await new Promise(r => setTimeout(r, 100));
            return { status: 'ok' };
        });

        server.get('/api/error', async (request, reply) => {
            reply.code(500);
            return { error: 'Server Error' };
        });

        await server.listen({ port: 0 });
        port = server.server.address().port;
    });

    afterAll(async () => {
        if (server) await server.close();
        if (configPath && fs.existsSync(configPath)) fs.unlinkSync(configPath);
        if (wsClient) wsClient.close();
    });

    const createConfig = (scenarios) => ({
        config: {
            baseUrl: `http://localhost:${port}`,
            timeout: 5000
        },
        scenarios
    });

    const writeConfig = (config) => {
        configPath = path.join(os.tmpdir(), `sentinel-integration-${Date.now()}.json`);
        fs.writeFileSync(configPath, JSON.stringify(config));
        return configPath;
    };

    test('should run multiple functional tests in sequence', async () => {
        const config = createConfig([
            {
                id: 'get-users',
                type: 'functional',
                method: 'GET',
                endpoint: '/api/users',
                expect: { status: 200 }
            },
            {
                id: 'create-user',
                type: 'functional',
                method: 'POST',
                endpoint: '/api/users',
                body: { name: 'Test User', role: 'admin' },
                expect: { status: 200 }
            }
        ]);

        writeConfig(config);
        service = new SentinelService(configPath);
        service.start();
        await sleep(200);

        const results = await service.runFunctionalTests();

        expect(results.results['get-users'].status).toBe('passed');
        expect(results.results['create-user'].status).toBe('passed');
    });

    test('should detect test failures correctly', async () => {
        const config = createConfig([
            {
                id: 'error-endpoint',
                type: 'functional',
                method: 'GET',
                endpoint: '/api/error',
                expect: { status: 200 }
            }
        ]);

        writeConfig(config);
        service = new SentinelService(configPath);
        service.start();
        await sleep(200);

        const results = await service.runFunctionalTests();

        expect(results.results['error-endpoint'].status).toBe('failed');
        expect(results.results['error-endpoint'].details.failures).toContain('Expected status 200, got 500');
    });

    test('should handle timeout scenarios', async () => {
        const config = createConfig([
            {
                id: 'slow-endpoint',
                type: 'functional',
                method: 'GET',
                endpoint: '/api/slow',
                expect: { status: 200 }
            }
        ]);

        writeConfig(config);
        service = new SentinelService(configPath);
        service.start();
        await sleep(200);

        const results = await service.runFunctionalTests();

        // Slow endpoint should still work with 5s timeout
        expect(results.results['slow-endpoint']).toBeDefined();
    });

    test('should maintain state across multiple runs', async () => {
        const config = createConfig([
            {
                id: 'state-test',
                type: 'functional',
                method: 'GET',
                endpoint: '/api/users',
                expect: { status: 200 }
            }
        ]);

        writeConfig(config);
        service = new SentinelService(configPath);
        service.start();
        await sleep(200);

        await service.runFunctionalTests();
        const state1 = service.getState();

        await service.runFunctionalTests();
        const state2 = service.getState();

        expect(state1.testResults['state-test']).toBeDefined();
        expect(state2.testResults['state-test']).toBeDefined();
    });

    test('should filter tests by specific ID', async () => {
        const config = createConfig([
            {
                id: 'only-this',
                type: 'functional',
                method: 'GET',
                endpoint: '/api/users',
                expect: { status: 200 }
            },
            {
                id: 'not-this',
                type: 'functional',
                method: 'GET',
                endpoint: '/api/nonexistent',
                expect: { status: 200 }
            }
        ]);

        writeConfig(config);
        service = new SentinelService(configPath);
        service.start();
        await sleep(200);

        const results = await service.runFunctionalTests('only-this');

        expect(results.results['only-this']).toBeDefined();
        expect(results.results['not-this']).toBeUndefined();
    });

    test('should emit events during test execution', async () => {
        const config = createConfig([
            {
                id: 'event-test',
                type: 'functional',
                method: 'GET',
                endpoint: '/api/users',
                expect: { status: 200 }
            }
        ]);

        writeConfig(config);
        service = new SentinelService(configPath);
        service.start();
        await sleep(200);

        const events = [];
        service.on('test_start', (data) => events.push({ type: 'test_start', data }));
        service.on('test_result', (data) => events.push({ type: 'test_result', data }));
        service.on('status', (data) => events.push({ type: 'status', data }));

        await service.runFunctionalTests();

        const startEvents = events.filter(e => e.type === 'test_start');
        const resultEvents = events.filter(e => e.type === 'test_result');

        expect(startEvents.length).toBeGreaterThan(0);
        expect(resultEvents.length).toBeGreaterThan(0);
    });
});

describe('WebSocket Integration', () => {
    let server;
    let port;
    let service;

    beforeAll(async () => {
        const fastifyServer = fastify();
        
        fastifyServer.get('/health', async () => ({ status: 'ok' }));
        
        await fastifyServer.listen({ port: 0 });
        port = fastifyServer.server.address().port;
        
        const config = {
            config: { baseUrl: `http://localhost:${port}`, timeout: 5000 },
            scenarios: [
                { id: 'health', type: 'functional', method: 'GET', endpoint: '/health', expect: { status: 200 } }
            ]
        };
        
        const os = require('os');
        const path = require('path');
        const fs = require('fs');
        const configPath = path.join(os.tmpdir(), `sentinel-ws-test-${Date.now()}.json`);
        fs.writeFileSync(configPath, JSON.stringify(config));
        
        service = new SentinelService(configPath);
        
        const wss = new WebSocket.Server({ server: fastifyServer.server });
        
        wss.on('connection', (ws) => {
            const state = service.getState();
            ws.send(JSON.stringify({ type: 'init', ...state }));
        });
        
        await new Promise(r => setTimeout(r, 300));
        
        server = fastifyServer;
    }, 10000);

    afterAll(async () => {
        if (server) await server.close();
    });

    test('should connect and receive init message', async () => {
        return new Promise(async (resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${port}`);
            
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Timeout'));
            }, 3000);

            ws.on('open', () => {
                console.log('WS Connected');
            });

            ws.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'init') {
                    clearTimeout(timeout);
                    expect(msg.testResults).toBeDefined();
                    ws.close();
                    resolve();
                }
            });

            ws.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }, 5000);
});
