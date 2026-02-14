const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');

class ConfigLoader {
    constructor(configPath) {
        this.configPath = configPath;
        this.config = null;
        this.listeners = [];
        this.watcher = null;
    }

    load() {
        try {
            const data = fs.readFileSync(this.configPath, 'utf8');
            this.config = JSON.parse(data);
            console.log(`[ConfigLoader] Loaded config from ${this.configPath}`);
            this.notifyListeners();
        } catch (err) {
            console.error(`[ConfigLoader] Error loading config: ${err.message}`);
        }
    }

    startWatching() {
        this.watcher = chokidar.watch(this.configPath, {
            persistent: true
        });

        this.watcher.on('change', () => {
            console.log(`[ConfigLoader] Config matched change in ${this.configPath}`);
            this.load();
        });

        // Initial load
        this.load();
    }

    onUpdate(callback) {
        this.listeners.push(callback);
    }

    notifyListeners() {
        this.listeners.forEach(cb => cb(this.config));
    }

    getConfig() {
        return this.config;
    }
}

module.exports = ConfigLoader;
