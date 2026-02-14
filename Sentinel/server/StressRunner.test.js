const StressRunner = require('./stressRunner');
const autocannon = require('autocannon');

jest.mock('autocannon');

describe('StressRunner', () => {
    let runner;

    beforeEach(() => {
        runner = new StressRunner();
        jest.clearAllMocks();
    });

    const mockGlobalConfig = {
        baseUrl: 'http://localhost:3000',
        globalHeaders: { 'Authorization': 'Bearer token' }
    };

    const mockFunctionalScenario = {
        endpoint: '/users',
        method: 'GET',
        headers: { 'X-Custom': 'value' },
        body: null
    };

    const mockStressScenario = {
        id: 'stress-1',
        parameters: {
            connections: 10,
            duration: 5,
            pipelining: 1
        },
        thresholds: {
            p95: 100,
            errors: 0.01
        }
    };

    test('should pass when metrics are within thresholds', async () => {
        // Mock autocannon yielding successful result
        autocannon.mockImplementation((config, callback) => {
            // Check config
            expect(config.url).toBe('http://localhost:3000/users');
            expect(config.connections).toBe(10);

            // Simulate result
            const result = {
                latency: { p50: 50, p95: 80, p99: 120 },
                requests: { total: 1000, average: 200 },
                errors: 0,
                timeouts: 0
            };
            callback(null, result);
            return { on: jest.fn() }; // mocks instance emitter
        });

        const result = await runner.run(mockStressScenario, mockFunctionalScenario, mockGlobalConfig);

        expect(result.status).toBe('passed');
        expect(result.failures).toEqual([]); // Failures should be empty array
    });

    test('should fail when p95 latency exceeds threshold', async () => {
        autocannon.mockImplementation((config, callback) => {
            const result = {
                latency: { p50: 50, p95: 150, p99: 200 }, // p95=150 > 100
                requests: { total: 1000, average: 200 },
                errors: 0,
                timeouts: 0
            };
            callback(null, result);
            return { on: jest.fn() };
        });

        const result = await runner.run(mockStressScenario, mockFunctionalScenario, mockGlobalConfig);

        expect(result.status).toBe('failed');
        expect(result.failures).toContain('p95 latency 150ms > threshold 100ms');
    });

    test('should fail when error rate exceeds threshold', async () => {
        autocannon.mockImplementation((config, callback) => {
            const result = {
                latency: { p50: 50, p95: 80, p99: 100 },
                requests: { total: 100, average: 20 },
                errors: 5, // 5% error rate > 1%
                timeouts: 0
            };
            // errorRate = 5/100 = 0.05
            callback(null, result);
            return { on: jest.fn() };
        });

        const result = await runner.run(mockStressScenario, mockFunctionalScenario, mockGlobalConfig);

        expect(result.status).toBe('failed');
        expect(result.failures[0]).toContain('Error rate 0.05 > threshold 0.01');
    });

    test('should handle autocannon error', async () => {
        autocannon.mockImplementation((config, callback) => {
            callback(new Error('Autocannon Failed'), null);
            return { on: jest.fn() };
        });

        const result = await runner.run(mockStressScenario, mockFunctionalScenario, mockGlobalConfig);

        expect(result.status).toBe('error');
        expect(result.error).toBe('Autocannon Failed');
    });
});
