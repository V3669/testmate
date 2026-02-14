const autocannon = require('autocannon');

class StressRunner {
    constructor() {
    }

    async run(stressScenario, functionalScenario, globalConfig) {
        return new Promise((resolve, reject) => {
            const baseUrl = globalConfig.baseUrl || 'http://localhost:3000';
            const url = `${baseUrl}${functionalScenario.endpoint}`;

            const config = {
                url: url,
                connections: stressScenario.parameters.connections || 10,
                pipelining: stressScenario.parameters.pipelining || 1,
                duration: stressScenario.parameters.duration || 10,
                method: functionalScenario.method,
                headers: {
                    ...globalConfig.globalHeaders,
                    ...functionalScenario.headers
                },
                body: functionalScenario.body ? JSON.stringify(functionalScenario.body) : undefined,
                // Autocannon specific
                title: stressScenario.id
            };

            // Resolve env vars in headers if needed (simplified)
            // Env vars are now handled by VariableInterpolator in SentinelService



            const instance = autocannon(config, (err, result) => {
                if (err) {
                    return resolve({
                        id: stressScenario.id,
                        status: 'error',
                        error: err.message
                    });
                }

                // Analyze specific thresholds
                const thresholds = stressScenario.thresholds || {};
                const p95 = result.latency.p95;
                const errorRate = result.errors / result.requests.total; // Approximate error rate

                let passed = true;
                const failures = [];

                if (thresholds.p95 && p95 > thresholds.p95) {
                    passed = false;
                    failures.push(`p95 latency ${p95}ms > threshold ${thresholds.p95}ms`);
                }

                if (thresholds.errors && errorRate > thresholds.errors) {
                    passed = false;
                    failures.push(`Error rate ${errorRate} > threshold ${thresholds.errors}`);
                }

                resolve({
                    id: stressScenario.id,
                    status: passed ? 'passed' : 'failed',
                    metrics: {
                        p50: result.latency.p50,
                        p95: result.latency.p95,
                        p99: result.latency.p99,
                        rps: result.requests.average,
                        errors: result.errors,
                        timeouts: result.timeouts
                    },
                    failures,
                    fullResult: result // Large object, maybe trim?
                });
            });

            // We can also attach listeners for progress if needed
            // autocannon.track(instance);
        });
    }
}

module.exports = StressRunner;
