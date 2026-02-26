#!/usr/bin/env node

const Module = require('module');
const originalLoad = Module._load;
const sqlite3Path = require.resolve('sqlite3');

Module._load = function(request, parent, isMain) {
  if (request === 'sqlite3') {
    return originalLoad(sqlite3Path, parent, isMain);
  }
  return originalLoad(request, parent, isMain);
};

// Set the command to 'start'
process.argv.push('start');

// Now run the actual server
require('./run');
