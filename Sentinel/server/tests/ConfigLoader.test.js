const ConfigLoader = require('../configLoader');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

const tempDir = os.tmpdir();

describe('ConfigLoader', () => {
    let loader;
    let tempConfigFile;

    beforeEach(() => {
        // Create unique temp file
        tempConfigFile = path.join(tempDir, `sentinel-test-config-${Date.now()}.json`);
        // Initial content
        fs.writeFileSync(tempConfigFile, JSON.stringify({ version: 1 }));
    });

    afterEach(() => {
        // Cleanup
        if (loader && loader.watcher) {
            loader.watcher.close();
        }
        if (fs.existsSync(tempConfigFile)) {
            fs.unlinkSync(tempConfigFile);
        }
    });

    test('should load initial config', () => {
        loader = new ConfigLoader(tempConfigFile);
        loader.load();

        expect(loader.getConfig()).toEqual({ version: 1 });
    });

    test('should handle invalid JSON gracefully', () => {
        const invalidFile = path.join(tempDir, `sentinel-invalid-${Date.now()}.json`);
        fs.writeFileSync(invalidFile, 'invalid-json');

        loader = new ConfigLoader(invalidFile);

        // Should not throw, but log error (not captured here)
        loader.load();

        expect(loader.getConfig()).toBeNull();

        fs.unlinkSync(invalidFile);
    });

    test('should detect file changes and notify listeners', async () => {
        loader = new ConfigLoader(tempConfigFile);
        const updateSpy = jest.fn();
        loader.onUpdate(updateSpy);

        loader.startWatching();

        // Give watcher time to start
        await sleep(100);

        // Update file
        fs.writeFileSync(tempConfigFile, JSON.stringify({ version: 2 }));

        // Wait for chokidar to pick up change
        // This can be flaky, so we wait a bit longer
        await sleep(1500);

        expect(updateSpy).toHaveBeenCalled();
        // The spy might be called with initial config if startWatching calls load()?
        // Looking at code: startWatching calls load() at end.
        // So spy might be called once for initial load (if validation passes/not null)
        // Wait, startWatching calls load(). load() notifies listeners.
        // So verify called with last config

        const lastCall = updateSpy.mock.calls[updateSpy.mock.calls.length - 1];
        expect(lastCall[0]).toEqual({ version: 2 });
    });

    test('should handle empty config file gracefully', () => {
        const emptyFile = path.join(tempDir, `sentinel-empty-${Date.now()}.json`);
        fs.writeFileSync(emptyFile, '');

        loader = new ConfigLoader(emptyFile);
        loader.load();

        expect(loader.getConfig()).toBeNull();

        fs.unlinkSync(emptyFile);
    });

    test('should handle watcher cleanup properly', () => {
        loader = new ConfigLoader(tempConfigFile);
        loader.startWatching();
        
        // Should not throw when closing
        expect(() => loader.watcher.close()).not.toThrow();
    });

    test('should notify multiple listeners', () => {
        fs.writeFileSync(tempConfigFile, JSON.stringify({ test: true }));
        loader = new ConfigLoader(tempConfigFile);
        loader.load();
        
        const spy1 = jest.fn();
        const spy2 = jest.fn();
        
        loader.onUpdate(spy1);
        loader.onUpdate(spy2);
        
        loader.notifyListeners({ test: true });
        
        expect(spy1).toHaveBeenCalledWith({ test: true });
        expect(spy2).toHaveBeenCalledWith({ test: true });
    });
});
