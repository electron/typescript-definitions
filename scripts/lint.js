const execSync = require('child_process').execSync
const path = require('path')
const cmd = `node ./node_modules/tslint/bin/tslint --format stylish "electron.d.ts"`

console.log(cmd)

try {
  // Child process writes directly to our own stdout
  execSync(cmd, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' })
} catch (_) {
  // Process should have printed out error info
}
