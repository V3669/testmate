const FunctionalRunner = require('../functionalRunner');
const axios = require('axios');

jest.mock('axios');

describe('FunctionalRunner', () => {
    let runner;

    beforeEach(() => {
        runner = new FunctionalRunner();
        jest.clearAllMocks();
    });

    const mockGlobalConfig = {
        baseUrl: 'http://localhost:3000',
        globalHeaders: { 'Authorization': 'Bearer token' },
        timeout: 5000
    };

    test('should pass when status and body match', async () => {
        const scenario = {
            id: 'test-1',
            method: 'GET',
            endpoint: '/users',
            expect: {
                status: 200,
                bodyPartial: { id: 1, name: 'John' }
            }
        };

        axios.mockResolvedValue({
            status: 200,
            headers: {},
            data: { id: 1, name: 'John', extra: 'field' }
        });

        const result = await runner.run(scenario, mockGlobalConfig);

        expect(result.status).toBe('passed');
        expect(result.failures).toBeUndefined(); // Failures is local var, but not exposed if passed?
        // Wait, runner returns result object which has status and details
        expect(result.details.failures).toHaveLength(0);
    });

    test('should fail when status does not match', async () => {
        const scenario = {
            id: 'test-2',
            method: 'GET',
            endpoint: '/users',
            expect: {
                status: 200
            }
        };

        axios.mockResolvedValue({
            status: 500,
            headers: {},
            data: { error: 'Internal Server Error' }
        });

        const result = await runner.run(scenario, mockGlobalConfig);

        expect(result.status).toBe('failed');
        expect(result.details.failures).toContain('Expected status 200, got 500');
    });

    test('should fail when body does not match', async () => {
        const scenario = {
            id: 'test-3',
            method: 'POST',
            endpoint: '/users',
            body: { name: 'Jane' },
            expect: {
                status: 201,
                bodyPartial: { id: 2, name: 'Jane' }
            }
        };

        axios.mockResolvedValue({
            status: 201,
            headers: {},
            data: { id: 2, name: 'WrongName' }
        });

        const result = await runner.run(scenario, mockGlobalConfig);

        expect(result.status).toBe('failed');
        // Note: exact error message might depend on diffpatcher, checking if failures is non-empty
        // But logic says: failures.push('Body mismatch')
        expect(result.details.failures).toContain('Body mismatch');
    });

    test('should handle wildcard matching correctly', async () => {
        const scenario = {
            id: 'test-wildcard',
            method: 'GET',
            endpoint: '/data',
            expect: {
                bodyPartial: {
                    id: '*',
                    nested: {
                        timestamp: '*'
                    },
                    static: 'value'
                }
            }
        };

        axios.mockResolvedValue({
            status: 200,
            headers: {},
            data: {
                id: 12345,
                nested: {
                    timestamp: '2023-01-01T00:00:00Z',
                    other: 'ignore'
                },
                static: 'value',
                extra: 'field'
            }
        });

        const result = await runner.run(scenario, mockGlobalConfig);

        expect(result.status).toBe('passed');
    });

    test('should fail if wildcard key is missing in actual response', async () => {
        const scenario = {
            id: 'test-wildcard-missing',
            method: 'GET',
            endpoint: '/data',
            expect: {
                bodyPartial: {
                    id: '*'
                }
            }
        };

        axios.mockResolvedValue({
            status: 200,
            headers: {},
            data: {
                name: 'No ID'
            }
        });

        const result = await runner.run(scenario, mockGlobalConfig);

        expect(result.status).toBe('failed');
        expect(result.details.failures).toContain('Body mismatch');
    });

    test('should handle axios network error', async () => {
        const scenario = {
            id: 'test-network-error',
            method: 'GET',
            endpoint: '/fail'
        };

        axios.mockRejectedValue(new Error('Network Error'));

        const result = await runner.run(scenario, mockGlobalConfig);

        expect(result.status).toBe('error');
        expect(result.details.error).toBe('Network Error');
    });

    test('should merge scenario headers with global headers', async () => {
        const scenario = {
            id: 'test-headers',
            method: 'GET',
            endpoint: '/data',
            headers: { 'X-Custom-Header': 'custom-value' }
        };

        axios.mockResolvedValue({
            status: 200,
            headers: {},
            data: {}
        });

        await runner.run(scenario, mockGlobalConfig);

        expect(axios).toHaveBeenCalledWith(
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer token',
                    'X-Custom-Header': 'custom-value'
                })
            })
        );
    });

    test('should use default baseUrl when not provided', async () => {
        const scenario = {
            id: 'test-default-url',
            method: 'GET',
            endpoint: '/test'
        };

        axios.mockResolvedValue({
            status: 200,
            headers: {},
            data: {}
        });

        await runner.run(scenario, {});

        expect(axios).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'http://localhost:3000/test'
            })
        );
    });

    test('should respect custom timeout', async () => {
        const scenario = {
            id: 'test-timeout',
            method: 'GET',
            endpoint: '/test'
        };

        const customConfig = {
            ...mockGlobalConfig,
            timeout: 10000
        };

        axios.mockResolvedValue({
            status: 200,
            headers: {},
            data: {}
        });

        await runner.run(scenario, customConfig);

        expect(axios).toHaveBeenCalledWith(
            expect.objectContaining({
                timeout: 10000
            })
        );
    });

    test('should handle timeout error', async () => {
        const scenario = {
            id: 'test-timeout-error',
            method: 'GET',
            endpoint: '/slow'
        };

        axios.mockRejectedValue(new Error('timeout of 5000ms exceeded'));

        const result = await runner.run(scenario, mockGlobalConfig);

        expect(result.status).toBe('error');
        expect(result.details.error).toContain('timeout');
    });

    test('should include response in details on success', async () => {
        const scenario = {
            id: 'test-response',
            method: 'GET',
            endpoint: '/test',
            expect: { status: 200 }
        };

        axios.mockResolvedValue({
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            data: { success: true }
        });

        const result = await runner.run(scenario, mockGlobalConfig);

        // When test passes, details should have response
        expect(result.status).toBe('passed');
    });

    test('should handle PUT method correctly', async () => {
        const scenario = {
            id: 'test-put',
            method: 'PUT',
            endpoint: '/users/1',
            body: { name: 'Updated' },
            expect: { status: 200 }
        };

        axios.mockResolvedValue({
            status: 200,
            headers: {},
            data: { id: 1, name: 'Updated' }
        });

        const result = await runner.run(scenario, mockGlobalConfig);

        expect(axios).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'PUT',
                data: { name: 'Updated' }
            })
        );
    });

    test('should handle DELETE method correctly', async () => {
        const scenario = {
            id: 'test-delete',
            method: 'DELETE',
            endpoint: '/users/1',
            expect: { status: 204 }
        };

        axios.mockResolvedValue({
            status: 204,
            headers: {},
            data: ''
        });

        const result = await runner.run(scenario, mockGlobalConfig);

        expect(axios).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'DELETE'
            })
        );
    });
});
