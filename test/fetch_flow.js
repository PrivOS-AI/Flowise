const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = '/home/roxane/.flowise/database.sqlite';
const targetId = '1bfa5bda-9fdc-45ff-92c3-7864d132da7a';
const outputPath = path.join(__dirname, 'flow_dump.json');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

const query = `SELECT flowData FROM chat_flow WHERE id = ?`;

db.get(query, [targetId], (err, row) => {
    if (err) {
        console.error('Error querying database:', err.message);
        process.exit(1);
    }

    if (!row) {
        console.error(`No flow found with ID: ${targetId}`);
        process.exit(1);
    }

    try {
        // flowData is usually a JSON string
        const flowData = JSON.parse(row.flowData);
        fs.writeFileSync(outputPath, JSON.stringify(flowData, null, 4));
        console.log(`Successfully wrote flow data to ${outputPath}`);
    } catch (parseError) {
        console.error('Error parsing flowData JSON:', parseError.message);
        process.exit(1);
    }
});

db.close();
