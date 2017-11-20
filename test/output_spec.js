'use strict'

const fs = require('fs')
const spawn = require('child_process').spawn
const expect = require('chai').expect
const path = require('path')

const OUTPUT_PATH = path.resolve(__dirname, '..', 'electron.d.ts')
let output

function getDefinitionsForInterface (interfaceName) {
  const interface_ = output.match(interfaceName + '[^{]+{([\\s\\S]+?)}')
  expect(interface_).to.be.an('array')
  return interface_[1].split(';').map(l => l.trim())
}

describe('Definition File', function () {
  this.timeout(30 * 1000)

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
    const AllElectronModules = getDefinitionsForInterface('MainInterface').concat(
      getDefinitionsForInterface('CommonInterface'),
      getDefinitionsForInterface('RendererInterface')
    )
    const knownElectronModules = ['clipboard', 'app', 'autoUpdater', 'dialog', 'ipcMain', 'Menu', 'MenuItem', 'webContents', 'BrowserWindow']
    knownElectronModules.forEach(knownModule => expect(AllElectronModules.some(tModule => tModule.indexOf(knownModule) === 0)).to.equal(true))
  })

  it('should not output classes that are not exported Electron modules', () => {
    const AllElectronModules = getDefinitionsForInterface('MainInterface').concat(
      getDefinitionsForInterface('CommonInterface'),
      getDefinitionsForInterface('RendererInterface')
    )
    const unKnownElectronModules = ['Clipboard', 'CrashReport', 'WebContents', 'menu', 'Session']
    unKnownElectronModules.forEach(knownModule => expect(AllElectronModules.some(tModule => tModule.indexOf(knownModule) === 0)).to.equal(false, knownModule))
  })
})
