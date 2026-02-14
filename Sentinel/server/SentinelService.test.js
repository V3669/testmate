const SentinelService = require('./SentinelService');
const path = require('path');

// Mock Dependencies
jest.mock('./configLoader');
jest.mock('./functionalRunner');
jest.mock('./stressRunner');

const ConfigLoader = require('./configLoader');
const FunctionalRunner = require('./functionalRunner');

describe('SentinelService', () => {
    let service;
    let mockExcludeConfig = {
        scenarios: [
            { id: 'test-1', type: 'functional', url: 'http://localhost' }
        ],
        config: {}
    };

    beforeEach(() => {
        // Reset mocks
        ConfigLoader.mockClear();
        FunctionalRunner.mockClear();

        // Setup mock behavior
        ConfigLoader.prototype.getConfig = jest.fn().mockReturnValue(mockExcludeConfig);
        ConfigLoader.prototype.onUpdate = jest.fn();
        ConfigLoader.prototype.startWatching = jest.fn();

        FunctionalRunner.prototype.run = jest.fn().mockResolvedValue({ status: 'passed' });

        service = new SentinelService('/mock/path');
    });

    test('should initialize and load config', () => {
        expect(ConfigLoader).toHaveBeenCalledWith('/mock/path');
        expect(service.getConfig()).toEqual(mockExcludeConfig);
    });

    test('should emit status events during functional test run', async () => {
        const startSpy = jest.fn();
        const endSpy = jest.fn();
        const resultSpy = jest.fn();

        service.on('status', status => {
            if (status.isRunning) startSpy();
            else endSpy();
        });
        service.on('test_result', resultSpy);

        await service.runFunctionalTests();

        expect(startSpy).toHaveBeenCalled();
        expect(FunctionalRunner.prototype.run).toHaveBeenCalled();
        expect(resultSpy).toHaveBeenCalledWith({ status: 'passed' });
        expect(endSpy).toHaveBeenCalled();
    });

    test('should update internal state after run', async () => {
        await service.runFunctionalTests();
        expect(service.getState().testResults['test-1']).toEqual({ status: 'passed' });
    });

    // Add more cases: stress tests, error handling, etc.
});
