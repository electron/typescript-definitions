'use strict'

const fs = require('fs')
const spawn = require('child_process').spawn
const expect = require('chai').expect
const path = require('path')

const OUTPUT_PATH = path.resolve(__dirname, '..', 'electron.d.ts')
let output

describe('Definition File', function () {
  this.timeout(20000)

  before((done) => {
    spawn('node', ['cli.js', '-o=electron.d.ts'], {
      cwd: path.resolve(__dirname, '..')
    }).on('exit', () => done())
  })

  it('should output a electron.d.ts file', () => {
    expect(fs.existsSync(OUTPUT_PATH)).to.equal(true)
    output = fs.readFileSync(OUTPUT_PATH, 'utf8')
  })

  it('should correctly output all exported Electron modules', () => {
    const AllElectron = output.match(/AllElectron {([\s\S]+?)}/)
    expect(AllElectron).to.be.an('array')
    const AllElectronModules = AllElectron[1].split(';').map(l => l.trim())
    const knownElectronModules = ['clipboard', 'app', 'autoUpdater', 'dialog', 'ipcMain', 'Menu', 'MenuItem', 'webContents', 'BrowserWindow']
    knownElectronModules.forEach(knownModule => expect(AllElectronModules.some(tModule => tModule.indexOf(knownModule) === 0)).to.equal(true))
  })

  it('should not output classes that are not exported Electron modules', () => {
    const AllElectron = output.match(/AllElectron {([\s\S]+?)}/)
    expect(AllElectron).to.be.an('array')
    const AllElectronModules = AllElectron[1].split(';').map(l => l.trim())
    const unKnownElectronModules = ['Clipboard', 'CrashReport', 'WebContents', 'menu', 'Session']
    unKnownElectronModules.forEach(knownModule => expect(AllElectronModules.some(tModule => tModule.indexOf(knownModule) === 0)).to.equal(false))
  })
})
