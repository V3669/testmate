/**
 * VariableInterpolator
 * Recursively replaces placeholders like {{env.VAR_NAME}} in strings, objects, and arrays.
 */
class VariableInterpolator {
    /**
     * Interpolate variables in a target object/string using the provided context.
     * @param {any} target - The object, array, or string to interpolate.
     * @param {object} context - Map of variable names to values (e.g., process.env).
     * @returns {any} - The interpolated result (new deep copy if object/array).
     */
    static interpolate(target, context = {}) {
        if (typeof target === 'string') {
            return this._replaceString(target, context);
        }
        if (Array.isArray(target)) {
            return target.map(item => this.interpolate(item, context));
        }
        if (target !== null && typeof target === 'object') {
            const result = {};
            for (const key of Object.keys(target)) {
                result[key] = this.interpolate(target[key], context);
            }
            return result;
        }
        return target;
    }

    static _replaceString(str, context) {
        // Regex to match {{env.VAR_NAME}} or {{VAR_NAME}}
        // We support nested keys like {{config.url}} if context has structure
        return str.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const value = this._getValue(key.trim(), context);
            return value !== undefined ? value : match; // Leave unmatched as is
        });
    }

    static _getValue(path, context) {
        // Handle "env.PORT" by digging into context
        const parts = path.split('.');
        let current = context;
        for (const part of parts) {
            if (current === undefined || current === null) return undefined;
            current = current[part];
        }
        return current;
    }
}

module.exports = VariableInterpolator;
