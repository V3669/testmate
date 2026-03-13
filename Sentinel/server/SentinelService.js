const EventEmitter = require('events');
const ConfigLoader = require('./configLoader');
const FunctionalRunner = require('./functionalRunner');
const StressRunner = require('./stressRunner');
const VariableInterpolator = require('./utils/VariableInterpolator');

class SentinelService extends EventEmitter {
    constructor(configPath) {
        super();
        this.configLoader = new ConfigLoader(configPath);
        this.functionalRunner = new FunctionalRunner();
        this.stressRunner = new StressRunner();

        // Encapsulated State
        this.testResults = {};
        this.stressResults = {};
        this.isRunning = false;

        // Bind auto-run
        this.configLoader.onUpdate(this._handleConfigUpdate.bind(this));
    }

    start() {
        this.configLoader.startWatching();
    }

    getConfig() {
        return this.configLoader.getConfig();
    }

    getConfigPath() {
        return this.configLoader.configPath;
    }

    getLastError() {
        return this.configLoader.getLastError();
    }

    getState() {
        return {
            testResults: this.testResults,
            stressResults: this.stressResults,
            isRunning: this.isRunning,
            config: this.getConfig(),
            configPath: this.getConfigPath()
        };
    }

    async _handleConfigUpdate(config) {
        await this.runFunctionalTests();
    }

    async runFunctionalTests(filterId = null) {
        const config = this.getConfig();
        
        // Check if config is loaded
        if (!config) {
            const error = this.getLastError() || "No config loaded";
            const suggestion = "Create tests.json in your project root or use configPath parameter";
            const example = {
                config: { baseUrl: "http://localhost:3000" },
                scenarios: [{ id: "test1", type: "functional", method: "GET", endpoint: "/api" }]
            };
            
            const errorResult = {
                status: "error",
                error,
                suggestion,
                example,
                configPath: this.getConfigPath()
            };
            
            this.emit('error', error);
            return { error: errorResult };
        }

        if (this.isRunning) {
            return { error: { message: "Tests already running" } };
        }
        
        this.isRunning = true;
        this.emit('status', { isRunning: true });

        // Apply Global Variable Interpolation to Config before running
        const interpolatedConfig = VariableInterpolator.interpolate(config, {
            env: process.env,
            ...config.env
        });

        const scenarios = interpolatedConfig.scenarios.filter(s => s.type === 'functional');
        
        if (scenarios.length === 0) {
            this.isRunning = false;
            return { error: { message: "No functional tests found in config" } };
        }
        
        const toRun = filterId ? scenarios.filter(s => s.id === filterId) : scenarios;
        
        if (filterId && toRun.length === 0) {
            this.isRunning = false;
            return { error: { message: `Test "${filterId}" not found` } };
        }

        const results = {};
        let passed = 0;
        let failed = 0;

        for (const scenario of toRun) {
            this.emit('test_start', { id: scenario.id });
            try {
                const result = await this.functionalRunner.run(scenario, interpolatedConfig.config);
                results[scenario.id] = result;
                this.testResults[scenario.id] = result;
                if (result.status === 'passed') passed++;
                else failed++;
                this.emit('test_result', result);
            } catch (err) {
                const errorResult = { id: scenario.id, status: 'error', error: err.message };
                results[scenario.id] = errorResult;
                this.emit('error', `Scenario ${scenario.id} failed: ${err.message}`);
                failed++;
            }
        }

        this.isRunning = false;
        this.emit('status', { isRunning: false });
        
        return {
            summary: {
                total: toRun.length,
                passed,
                failed,
                baseUrl: interpolatedConfig.config.baseUrl
            },
            results
        };
    }

    async runStressTest(stressScenarioId) {
        const config = this.getConfig();
        if (!config) {
            const error = this.getLastError() || "No config loaded";
            throw new Error(`${error}. Create tests.json in your project root.`);
        }

        const interpolatedConfig = VariableInterpolator.interpolate(config, {
            env: process.env,
            ...config.env
        });

        const stressScenario = interpolatedConfig.scenarios.find(s => s.id === stressScenarioId && s.type === 'stress');
        if (!stressScenario) {
            const available = interpolatedConfig.scenarios
                .filter(s => s.type === 'stress')
                .map(s => s.id);
            throw new Error(`Stress scenario "${stressScenarioId}" not found. Available: ${available.join(', ')}`);
        }

        const targetId = stressScenario.targetScenarioId;
        const functionalScenario = interpolatedConfig.scenarios.find(s => s.id === targetId);

        if (!functionalScenario) {
            throw new Error(`Target functional scenario "${targetId}" not found. Create it in your config.`);
        }

        this.emit('stress_start', { id: stressScenarioId });

        try {
            const result = await this.stressRunner.run(stressScenario, functionalScenario, interpolatedConfig.config);
            this.stressResults[stressScenarioId] = result;
            this.emit('stress_result', result);
            return result;
        } catch (err) {
            this.emit('error', `Stress test failed: ${err.message}`);
            throw err;
        }
    }
    
    // Unified run_tests method
    async runTests(options = {}) {
        const { type = 'functional', scenarioId, configPath } = options;
        
        // Reload config if path provided
        if (configPath) {
            this.configLoader.configPath = configPath;
            this.configLoader.load();
        }
        
        if (type === 'functional' || type === 'all') {
            return await this.runFunctionalTests(scenarioId);
        }
        
        if (type === 'stress') {
            if (!scenarioId) {
                throw new Error("scenarioId required for stress tests");
            }
            return await this.runStressTest(scenarioId);
        }
        
        throw new Error(`Unknown test type: ${type}`);
    }
}

module.exports = SentinelService;
