#!/usr/bin/env node

const path = require('path');
const Module = require('module');
const originalLoad = Module._load;

// Patch to debug sqlite3 loading
Module._load = function(request, parent, isMain) {
  if (request === 'sqlite3') {
    console.log('=== sqlite3 require ===');
    console.log('parent:', parent?.filename);
    console.log('cwd:', process.cwd());
    console.log('Trying from:', path.resolve(process.cwd() + "/node_modules/" + request));
  }
  return originalLoad(request, parent, isMain);
};

// Now run the actual server
require('./run');
