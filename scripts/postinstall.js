'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function findIoBrokerRoot() {
  const candidates = [
    // Walk up from the installed module location: scripts/ -> iobroker.aura/ -> node_modules/ -> root
    path.resolve(__dirname, '..', '..', '..'),
    process.env.INIT_CWD,
    process.cwd(),
  ].filter(Boolean);

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'iobroker.json'))) {
      return dir;
    }
  }
  return null;
}

const ioBrokerRoot = findIoBrokerRoot();

if (!ioBrokerRoot) {
  // Not inside an ioBroker installation — skip (local dev)
  process.exit(0);
}

// Prefer the local controller script over the global CLI to avoid PATH issues
const controllerScript = path.join(
  ioBrokerRoot,
  'node_modules',
  'iobroker.js-controller',
  'iobroker.js',
);

const args = fs.existsSync(controllerScript)
  ? [controllerScript, 'add', 'aura']
  : null;

if (!args) {
  console.log('ioBroker controller not found, skipping auto-instance creation.');
  process.exit(0);
}

console.log(`Creating aura instance in ${ioBrokerRoot}...`);

const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  cwd: ioBrokerRoot,
  timeout: 30000,
});

if (result.status !== 0) {
  console.log('Auto-instance creation skipped (may already exist or iobroker not ready).');
}
