
const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

// Configuration // Assuming Flowise runs on 3000
const TARGET_URL = 'http://localhost:8556'; // Default ClaudeWS port
const OUTPUT_FILE = path.join(__dirname, 'debug_output.md');

// Helper to write to Markdown
const logToMd = (header, content) => {
    const timestamp = new Date().toISOString();
    const entry = `\n## ${header} (${timestamp})\n\n\`\`\`json\n${JSON.stringify(content, null, 2)}\n\`\`\`\n`;
    fs.appendFileSync(OUTPUT_FILE, entry);
    console.log(`[${header}]`, content);
};

// Initialize Output File
fs.writeFileSync(OUTPUT_FILE, '# ClaudeWS Debug Output\n');

console.log('Connecting directly to', TARGET_URL);

// Connect Socket
const socket = io(TARGET_URL, {
    reconnection: false,
    transports: ['websocket', 'polling']
});

socket.on('connect', () => {
    logToMd('Socket Connected', { socketId: socket.id });

    // Payload to Send
    const payload = {
        taskId: 'debug-task-' + Date.now(),
        // USER REQUEST: Test with STRING prompt
        prompt: '/flow Create a simple agent flow with an agent and http request.',
        outputFormat: 'custom',
        outputSchema: JSON.stringify({
            flow: "Object. The agent flow JSON with 'nodes' and 'edges' arrays."
        }),
        force_create: true,
        projectId: 'debug-project',
        projectName: 'Debug Project',
        taskTitle: 'Debug Task',
        context: {
            isAgentFlowGenerator: true
        }
    };

    logToMd('Sending Payload', payload);
    socket.emit('attempt:start', payload);
});

socket.on('disconnect', () => {
    logToMd('Socket Disconnected', {});
});

socket.on('connect_error', (error) => {
    logToMd('Socket Connection Error', { message: error.message, stack: error.stack });
});

// Capture All Events
socket.onAny((event, ...args) => {
    logToMd(`Event Received: ${event}`, args);

    if (event === 'attempt:finished') {
        console.log('Debug session finished. Check', OUTPUT_FILE);
        process.exit(0);
    }
});


