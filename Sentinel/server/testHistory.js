const fs = require('fs');
const path = require('path');

class TestHistory {
    constructor(storagePath = null) {
        this.storagePath = storagePath || path.join(process.cwd(), '.testmate-history.json');
        this.history = [];
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.storagePath)) {
                const data = fs.readFileSync(this.storagePath, 'utf8');
                this.history = JSON.parse(data);
            }
        } catch (err) {
            console.log('[TestHistory] Starting fresh history');
            this.history = [];
        }
    }

    save() {
        try {
            const dir = path.dirname(this.storagePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.storagePath, JSON.stringify(this.history, null, 2));
        } catch (err) {
            console.error('[TestHistory] Save error:', err.message);
        }
    }

    add(result, type, configPath) {
        const entry = {
            id: result.id || result.scenarioId,
            type,
            status: result.status,
            timestamp: new Date().toISOString(),
            project: configPath ? path.basename(path.dirname(configPath)) : 'unknown',
            configPath,
            latency: result.latency || result.metrics?.p50,
            metrics: result.metrics || null,
            details: result.details || null,
            error: result.error || null
        };

        this.history.unshift(entry);
        
        // Keep last 100 entries
        if (this.history.length > 100) {
            this.history = this.history.slice(0, 100);
        }
        
        this.save();
        return entry;
    }

    getAll() {
        return this.history;
    }

    getByProject(project) {
        return this.history.filter(h => h.project === project);
    }

    getRecent(limit = 10) {
        return this.history.slice(0, limit);
    }

    clear() {
        this.history = [];
        this.save();
    }
}

module.exports = TestHistory;
