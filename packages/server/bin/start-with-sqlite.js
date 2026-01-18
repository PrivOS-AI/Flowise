#!/usr/bin/env node

// Pre-load sqlite3 AND better-sqlite3 into node's module cache to make them available for typeorm
try {
    const sqlite3 = require('sqlite3');
    console.log('sqlite3 preloaded');
} catch (e) {
    console.log('sqlite3 not available:', e.message);
}

try {
    const betterSqlite3 = require('better-sqlite3');
    console.log('better-sqlite3 preloaded');
} catch (e) {
    console.log('better-sqlite3 not available:', e.message);
}

// Set the command arguments to start the server
process.argv = [process.argv[0], process.argv[1], 'start'];

// Now run the actual server
require('./run');
