const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');

class ConfigLoader {
    constructor(configPath) {
        this.configPath = configPath;
        this.config = null;
        this.listeners = [];
        this.watcher = null;
        this.lastError = null;
    }

    load() {
        try {
            if (!fs.existsSync(this.configPath)) {
                this.lastError = `Config file not found: ${this.configPath}`;
                console.error(`[ConfigLoader] ${this.lastError}`);
                console.error(`[ConfigLoader] Create tests.json in your project root or specify configPath`);
                this.config = null;
                return;
            }
            
            const data = fs.readFileSync(this.configPath, 'utf8');
            this.config = JSON.parse(data);
            this.lastError = null;
            console.log(`[ConfigLoader] Loaded config from ${this.configPath}`);
            console.log(`[ConfigLoader] Found ${this.config.scenarios?.length || 0} test scenarios`);
            this.notifyListeners();
        } catch (err) {
            this.lastError = `Error loading config: ${err.message}`;
            console.error(`[ConfigLoader] ${this.lastError}`);
            this.config = null;
        }
    }

    getLastError() {
        return this.lastError;
    }

    startWatching() {
        // Don't watch if file doesn't exist yet
        if (!fs.existsSync(this.configPath)) {
            console.log(`[ConfigLoader] Config file not found, waiting for: ${this.configPath}`);
            // Watch parent directory for the file
            const dir = path.dirname(this.configPath);
            const file = path.basename(this.configPath);
            
            this.watcher = chokidar.watch(dir, {
                persistent: true
            });
            
            this.watcher.on('add', (filepath) => {
                if (path.basename(filepath) === file) {
                    console.log(`[ConfigLoader] Config file created: ${filepath}`);
                    this.load();
                }
            });
            
            this.watcher.on('change', () => {
                if (fs.existsSync(this.configPath)) {
                    console.log(`[ConfigLoader] Config file changed: ${this.configPath}`);
                    this.load();
                }
            });
            return;
        }

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
