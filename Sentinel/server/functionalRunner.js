const axios = require('axios');
const jsondiffpatch = require('jsondiffpatch');

class FunctionalRunner {
    constructor() {
        this.diffpatcher = jsondiffpatch.create();
    }

    async run(scenario, globalConfig) {
        const startTime = Date.now();
        const result = {
            id: scenario.id,
            timestamp: new Date().toISOString(),
            status: 'pending',
            details: {},
            diff: null,
            latency: 0
        };

        try {
            const baseUrl = globalConfig.baseUrl || 'http://localhost:3000';
            const url = `${baseUrl}${scenario.endpoint}`;

            const config = {
                method: scenario.method,
                url: url,
                headers: {
                    ...globalConfig.globalHeaders,
                    ...scenario.headers
                },
                data: scenario.body,
                timeout: globalConfig.timeout || 5000,
                validateStatus: () => true // Don't throw on non-200
            };

            // Replace env vars
            // Simplified env var replacement logic
            // Env vars are now handled by VariableInterpolator in SentinelService


            const response = await axios(config);
            const latency = Date.now() - startTime;
            result.latency = latency;

            // Assertion Logic
            let passed = true;
            const failures = [];

            // 1. Status Check
            if (scenario.expect.status && response.status !== scenario.expect.status) {
                passed = false;
                failures.push(`Expected status ${scenario.expect.status}, got ${response.status}`);
            }

            // 2. Body Check
            if (scenario.expect.bodyPartial) {
                // Deep compare
                // Note: handling '*' wildcard requires custom logic or traversing the diff
                // For simplicity, we use diffpatcher but need to handle wildcards manually or assume exact match for non-wildcards
                // This is a simplified implementation. Proper wildcard support requires traversing the expected object.

                const expected = scenario.expect.bodyPartial;
                const actual = response.data;

                // Simple wildcard support: if expected value is '*', we just check key existence
                // We'll traverse expected and if value is '*', set actual value to '*' to ignore diff
                const maskWildcards = (exp, act) => {
                    if (typeof exp === 'object' && exp !== null && typeof act === 'object' && act !== null) {
                        for (const key in exp) {
                            if (exp[key] === '*') {
                                if (act.hasOwnProperty(key)) {
                                    act[key] = '*'; // Mask it
                                }
                            } else {
                                if (act.hasOwnProperty(key)) {
                                    maskWildcards(exp[key], act[key]);
                                }
                            }
                        }
                    }
                };

                // Clone actual to not mutate original response data
                const actualClone = JSON.parse(JSON.stringify(actual));

                // Helper to remove extra keys for partial matching
                const cleanExtraKeys = (exp, act) => {
                    if (typeof exp === 'object' && exp !== null && typeof act === 'object' && act !== null) {
                        if (!Array.isArray(exp) && !Array.isArray(act)) {
                            for (const key of Object.keys(act)) {
                                if (!exp.hasOwnProperty(key)) {
                                    delete act[key];
                                } else {
                                    cleanExtraKeys(exp[key], act[key]);
                                }
                            }
                        }
                    }
                };

                cleanExtraKeys(expected, actualClone);
                maskWildcards(expected, actualClone);

                const delta = this.diffpatcher.diff(expected, actualClone);
                if (delta) {
                    passed = false;
                    failures.push('Body mismatch');
                    result.diff = delta;
                }
            }

            result.status = passed ? 'passed' : 'failed';
            result.details = {
                request: {
                    method: config.method,
                    url: config.url,
                    headers: config.headers,
                    body: config.data
                },
                response: {
                    status: response.status,
                    headers: response.headers,
                    body: response.data
                },
                failures
            };

        } catch (error) {
            result.status = 'error';
            result.details = { error: error.message };
            result.latency = Date.now() - startTime;
        }

        return result;
    }
}

module.exports = FunctionalRunner;
