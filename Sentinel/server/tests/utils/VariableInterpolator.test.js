const VariableInterpolator = require('../../utils/VariableInterpolator');

describe('VariableInterpolator', () => {
    const context = {
        env: {
            API_URL: 'http://localhost:3000',
            API_KEY: 'secret-key',
            PORT: 8080
        },
        user: {
            name: 'Alice',
            id: 123
        }
    };

    test('should replace simple string variables', () => {
        const input = 'Hello {{user.name}}';
        const output = VariableInterpolator.interpolate(input, context);
        expect(output).toBe('Hello Alice');
    });

    test('should replace env variables', () => {
        const input = 'Connect to {{env.API_URL}}';
        const output = VariableInterpolator.interpolate(input, context);
        expect(output).toBe('Connect to http://localhost:3000');
    });

    test('should handle arrays', () => {
        const input = ['{{user.name}}', 'static'];
        const output = VariableInterpolator.interpolate(input, context);
        expect(output).toEqual(['Alice', 'static']);
    });

    test('should handle nested objects (deep substitution)', () => {
        const input = {
            url: '{{env.API_URL}}/users',
            headers: {
                Authorization: 'Bearer {{env.API_KEY}}',
                'X-User-ID': '{{user.id}}'
            }
        };
        const output = VariableInterpolator.interpolate(input, context);
        expect(output).toEqual({
            url: 'http://localhost:3000/users',
            headers: {
                Authorization: 'Bearer secret-key',
                'X-User-ID': '123' // Converted to string due to replacement
            }
        });
    });

    test('should leave unmatched variables as is', () => {
        const input = 'Hello {{unknown.var}}';
        const output = VariableInterpolator.interpolate(input, context);
        expect(output).toBe('Hello {{unknown.var}}');
    });

    test('should verify type safety (numbers in context)', () => {
        // If context value is number, replace puts it in string
        const input = 'Port is {{env.PORT}}';
        const output = VariableInterpolator.interpolate(input, context);
        expect(output).toBe('Port is 8080');
    });

    test('should handle null/undefined gracefully', () => {
        expect(VariableInterpolator.interpolate(null, context)).toBeNull();
        expect(VariableInterpolator.interpolate(undefined, context)).toBeUndefined();
    });

    test('should handle deep nested objects', () => {
        const input = {
            level1: {
                level2: {
                    level3: '{{user.name}}'
                }
            }
        };
        const output = VariableInterpolator.interpolate(input, context);
        expect(output.level1.level2.level3).toBe('Alice');
    });

    test('should handle mixed arrays with objects', () => {
        const input = [
            '{{user.name}}',
            { key: '{{env.API_URL}}' },
            ['nested', '{{user.id}}']
        ];
        const output = VariableInterpolator.interpolate(input, context);
        expect(output[0]).toBe('Alice');
        expect(output[1].key).toBe('http://localhost:3000');
        expect(output[2][1]).toBe('123');
    });

    test('should handle boolean and number values unchanged', () => {
        const input = {
            bool: true,
            num: 42,
            nested: {
                bool: false,
                num: 0
            }
        };
        const output = VariableInterpolator.interpolate(input, context);
        expect(output.bool).toBe(true);
        expect(output.num).toBe(42);
        expect(output.nested.bool).toBe(false);
        expect(output.nested.num).toBe(0);
    });

    test('should handle empty string interpolation', () => {
        const input = '';
        const output = VariableInterpolator.interpolate(input, context);
        expect(output).toBe('');
    });

    test('should handle template with no variables', () => {
        const input = 'No variables here';
        const output = VariableInterpolator.interpolate(input, context);
        expect(output).toBe('No variables here');
    });

    test('should handle partial variable match', () => {
        const input = 'Hello {{user.name}}, your API is {{env.API_URL}}';
        const output = VariableInterpolator.interpolate(input, context);
        expect(output).toBe('Hello Alice, your API is http://localhost:3000');
    });
});
