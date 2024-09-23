import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const OUTPUT_PATH = path.resolve(import.meta.dirname, '..', 'electron.d.ts');
let output: string;

function getDefinitionsForInterface(interfaceName: string) {
  const interface_ = output.match(interfaceName + '[^{]+{([\\s\\S]+?)}');
  if (!interface_) console.log(interfaceName);
  expect(interface_).toBeTruthy();
  return interface_![1].split(';').map((l) => l.trim());
}

describe('Definition File', function () {
  beforeAll((done) => {
    spawn('node', ['dist/bin.js', '--api=electron-api.json'], {
      cwd: path.resolve(import.meta.dirname, '..'),
    }).on('exit', () => done());
  });

  it('should output a electron.d.ts file', () => {
    expect(fs.existsSync(OUTPUT_PATH)).toEqual(true);
    output = fs.readFileSync(OUTPUT_PATH, 'utf8');
  });

  it('should correctly output all exported Electron modules', () => {
    const AllElectronModules = getDefinitionsForInterface('MainInterface').concat(
      getDefinitionsForInterface('CrossProcessExports'),
      getDefinitionsForInterface('Renderer'),
    );
    const knownElectronModules = [
      'clipboard',
      'app',
      'autoUpdater',
      'dialog',
      'ipcMain',
      'Menu',
      'MenuItem',
      'webContents',
      'BrowserWindow',
    ];
    knownElectronModules.forEach((knownModule) =>
      expect(AllElectronModules.some((tModule) => tModule.indexOf(knownModule) === 0)).toEqual(
        true,
      ),
    );
  });

  it('should not output classes that are not exported Electron modules', () => {
    const AllElectronModules = getDefinitionsForInterface('MainInterface').concat(
      getDefinitionsForInterface('CrossProcessExports'),
      getDefinitionsForInterface('Renderer'),
    );
    const unKnownElectronModules = ['Clipboard', 'CrashReport', 'WebContents', 'menu', 'Session'];
    unKnownElectronModules.forEach((knownModule) =>
      expect(AllElectronModules.some((tModule) => tModule.indexOf(knownModule) === 0)).toEqual(
        false,
      ),
    );
  });
});
