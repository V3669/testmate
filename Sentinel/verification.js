const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
    console.log('Connected to Sentinel');

    // Trigger a test
    ws.send(JSON.stringify({ type: 'run_test', id: 'health_check' }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    console.log('Received:', msg.type);
    if (msg.type === 'test_result') {
        console.log('Test Result:', msg.payload.status);
        process.exit(0);
    }
});

setTimeout(() => {
    console.log('Timeout');
    process.exit(1);
}, 5000);
