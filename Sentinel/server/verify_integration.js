const WebSocket = require('ws');
const path = require('path');
const { spawn } = require('child_process');

// 1. Start Server in Standalone Mode
console.log("Starting Sentinel Server...");
const server = spawn('node', ['index.js'], { env: { ...process.env, PORT: 3001 }, cwd: __dirname });

server.stdout.on('data', (d) => console.log(`[SERVER]: ${d}`));
server.stderr.on('data', (d) => console.error(`[SERVER ERR]: ${d}`));

// 2. Wait for server to be ready
setTimeout(() => {
    console.log("Connecting WebSocket...");
    const ws = new WebSocket('ws://localhost:3000');

    ws.on('open', () => {
        console.log("WebSocket Open!");

        // Trigger Run
        console.log("Triggering functional tests...");
        ws.send(JSON.stringify({ type: 'run_test', id: 'health_check' }));
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        console.log("Received:", msg.type);

        if (msg.type === 'init') {
            console.log("Init State:", Object.keys(msg));
        }

        if (msg.type === 'test_result') {
            console.log("Test Result:", msg.payload.status);
            if (msg.payload.status === 'failed') { // Expect failure because target is not running or 404
                console.log("SUCCESS: Received result (even if failed request)");
                process.exit(0);
            }
        }
    });

    ws.on('error', (e) => {
        console.error("WS Error:", e);
        process.exit(1);
    });

}, 2000);

// Cleanup
process.on('exit', () => server.kill());
