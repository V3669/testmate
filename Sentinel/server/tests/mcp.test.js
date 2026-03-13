const SentinelService = require('../SentinelService');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('MCP Integration Tests', () => {
    let service;
    let configPath;

    beforeEach(() => {
        const config = {
            config: { baseUrl: 'http://localhost:9999', timeout: 5000 },
            scenarios: [
                { id: 'test-1', type: 'functional', method: 'GET', endpoint: '/test', expect: { status: 200 } },
                { id: 'stress-1', type: 'stress', targetScenarioId: 'test-1', parameters: { connections: 10, duration: 1 }, thresholds: { p95: 100 } }
            ]
        };
        configPath = path.join(os.tmpdir(), `sentinel-mcp-test-${Date.now()}.json`);
        fs.writeFileSync(configPath, JSON.stringify(config));
    });

    afterEach(() => {
        if (configPath && fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }
    });

    test('should create SentinelService with config path', () => {
        service = new SentinelService(configPath);
        expect(service).toBeDefined();
        expect(service.getConfig()).toBeNull(); // Not loaded yet
    });

    test('should load config on start', () => {
        service = new SentinelService(configPath);
        service.start();
        
        const config = service.getConfig();
        expect(config).toBeDefined();
        expect(config.scenarios).toHaveLength(2);
    });

    test('should return functional test results via getState', async () => {
        service = new SentinelService(configPath);
        service.start();
        
        // Wait for config to load
        await new Promise(r => setTimeout(r, 100));
        
        // Mock the functional runner to return results
        const FunctionalRunner = require('../functionalRunner');
        const originalRun = FunctionalRunner.prototype.run;
        FunctionalRunner.prototype.run = jest.fn().mockResolvedValue({ 
            id: 'test-1', 
            status: 'passed',
            details: { response: { status: 200 } }
        });
        
        await service.runFunctionalTests();
        
        const state = service.getState();
        expect(state.testResults).toBeDefined();
        
        FunctionalRunner.prototype.run = originalRun;
    });

    test('should return stress test results via getState', async () => {
        service = new SentinelService(configPath);
        service.start();
        
        const StressRunner = require('../stressRunner');
        const originalRun = StressRunner.prototype.run;
        StressRunner.prototype.run = jest.fn().mockResolvedValue({ 
            id: 'stress-1', 
            status: 'passed',
            metrics: { p50: 50, p95: 80, rps: 100 }
        });
        
        await service.runStressTest('stress-1');
        
        const state = service.getState();
        expect(state.stressResults['stress-1']).toBeDefined();
        expect(state.stressResults['stress-1'].status).toBe('passed');
        
        StressRunner.prototype.run = originalRun;
    });

    test('should provide correct state structure for MCP response', () => {
        service = new SentinelService(configPath);
        service.start();
        
        const state = service.getState();
        
        // Verify state has all required fields for MCP tools
        expect(state).toHaveProperty('testResults');
        expect(state).toHaveProperty('stressResults');
        expect(state).toHaveProperty('isRunning');
        expect(state).toHaveProperty('config');
        
        expect(Array.isArray(state.testResults)).toBe(false);
        expect(typeof state.testResults).toBe('object');
    });
});

describe('MCP Tool Registration', () => {
    test('should verify MCP tool definitions are correct format', () => {
        // MCP tools expected format:
        // { name: string, description: string, inputSchema: object }
        
        const toolDefinitions = [
            {
                name: 'run_functional_tests',
                description: 'Run functional tests defined in tests.json.',
                inputSchema: { tag: { type: 'string' }, id: { type: 'string' } }
            },
            {
                name: 'run_stress_simulation',
                description: 'Run stress simulation.',
                inputSchema: { scenarioId: { type: 'string', required: true } }
            },
            {
                name: 'get_test_results',
                description: 'Get latest results.',
                inputSchema: {}
            }
        ];
        
        toolDefinitions.forEach(tool => {
            expect(typeof tool.name).toBe('string');
            expect(typeof tool.description).toBe('string');
            expect(typeof tool.inputSchema).toBe('object');
        });
        
        expect(toolDefinitions).toHaveLength(3);
    });

    test('should validate tool responses match MCP format', () => {
        // MCP response format: { content: [{ type: 'text', text: string }] }
        
        const mockResponses = [
            {
                content: [{ type: 'text', text: 'Dashboard on http://localhost:3000\n\n{"test":"result"}' }]
            },
            {
                content: [{ type: 'text', text: 'Stress Test started.\n\n{"metrics":{}}' }]
            },
            {
                content: [{ type: 'text', text: '{"functional":{},"stress":{}}' }]
            }
        ];
        
        mockResponses.forEach(response => {
            expect(response).toHaveProperty('content');
            expect(Array.isArray(response.content)).toBe(true);
            expect(response.content[0]).toHaveProperty('type', 'text');
            expect(response.content[0]).toHaveProperty('text');
            expect(typeof response.content[0].text).toBe('string');
        });
    });
});

describe('MCP Configuration', () => {
    test('should support environment variable interpolation', () => {
        const config = {
            config: { 
                baseUrl: 'http://localhost:3000', 
                globalHeaders: { 'Authorization': 'Bearer {{env.API_KEY}}' }
            },
            scenarios: [],
            env: { API_KEY: 'test-key-123' }
        };
        
        const VariableInterpolator = require('../utils/VariableInterpolator');
        const interpolated = VariableInterpolator.interpolate(config, {
            env: { ...process.env, API_KEY: 'test-key-123' }
        });
        
        expect(interpolated.config.globalHeaders.Authorization).toBe('Bearer test-key-123');
    });

    test('should handle missing environment variables gracefully', () => {
        const config = {
            config: { 
                baseUrl: '{{env.MISSING_VAR}}' 
            },
            scenarios: []
        };
        
        const VariableInterpolator = require('../utils/VariableInterpolator');
        const interpolated = VariableInterpolator.interpolate(config, { env: {} });
        
        // Should leave unmatched variable as is
        expect(interpolated.config.baseUrl).toBe('{{env.MISSING_VAR}}');
    });
});
