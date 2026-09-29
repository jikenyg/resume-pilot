const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tests = fs.readdirSync(path.join(root, 'tests')).filter(file => file.endsWith('.cjs')).sort();
for (const test of tests) {
  console.log(`\nRunning ${test}`);
  const result = spawnSync(process.execPath, [path.join(root, 'tests', test)], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`\nAll ${tests.length} test suites passed.`);
