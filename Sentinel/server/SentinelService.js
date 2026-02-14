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

    getState() {
        return {
            testResults: this.testResults,
            stressResults: this.stressResults,
            isRunning: this.isRunning,
            config: this.getConfig()
        };
    }

    async _handleConfigUpdate(config) {
        // Debounce? Or run immediately.
        // this.emit('log', "Config updated, auto-running functional tests...");
        await this.runFunctionalTests();
    }

    async runFunctionalTests(filterId = null) {
        if (this.isRunning) return; // Prevent concurrent runs
        this.isRunning = true;
        this.emit('status', { isRunning: true });

        const config = this.getConfig();
        if (!config) {
            this.emit('error', "No config loaded");
            this.isRunning = false;
            return;
        }

        // Apply Global Variable Interpolation to Config before running
        // This ensures the Runners receive fully resolved objects
        const interpolatedConfig = VariableInterpolator.interpolate(config, {
            env: process.env, // Or custom env vars defined in config
            ...config.env // Support local env block in tests.json
        });

        const scenarios = interpolatedConfig.scenarios.filter(s => s.type === 'functional');
        const toRun = filterId ? scenarios.filter(s => s.id === filterId) : scenarios;

        const results = {};

        for (const scenario of toRun) {
            this.emit('test_start', { id: scenario.id });
            try {
                const result = await this.functionalRunner.run(scenario, interpolatedConfig.config);
                results[scenario.id] = result;
                this.testResults[scenario.id] = result; // Update state
                this.emit('test_result', result);
            } catch (err) {
                this.emit('error', `Scenario ${scenario.id} failed: ${err.message}`);
            }
        }

        this.isRunning = false;
        this.emit('status', { isRunning: false });
        return results;
    }

    async runStressTest(stressScenarioId) {
        const config = this.getConfig();
        if (!config) throw new Error("No config loaded");

        // Interpolation
        const interpolatedConfig = VariableInterpolator.interpolate(config, {
            env: process.env,
            ...config.env
        });

        const stressScenario = interpolatedConfig.scenarios.find(s => s.id === stressScenarioId && s.type === 'stress');
        if (!stressScenario) throw new Error(`Stress scenario ${stressScenarioId} not found`);

        const targetId = stressScenario.targetScenarioId;
        const functionalScenario = interpolatedConfig.scenarios.find(s => s.id === targetId);

        if (!functionalScenario) throw new Error(`Target functional scenario ${targetId} not found`);

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
}

module.exports = SentinelService;
