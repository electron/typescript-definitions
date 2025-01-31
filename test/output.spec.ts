import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

const OUTPUT_PATH = path.resolve(import.meta.dirname, '..', 'electron.d.ts');
let output: string;

function getDefinitionsForInterface(interfaceName: string) {
  const interface_ = output.match('namespace ' + interfaceName + '[^{]+{([\\s\\S]+?)\n  }');
  expect(interface_).toBeTruthy();
  return interface_![1].split('\n').map((l) => l.trim());
}

describe('Definition File', function () {
  beforeAll(() => {
    spawnSync('node', ['dist/bin.js', '--api=test/fixture/electron-api.json'], {
      cwd: path.resolve(import.meta.dirname, '..'),
    });
  });

  it('should output a electron.d.ts file', () => {
    expect(fs.existsSync(OUTPUT_PATH)).toEqual(true);
    output = fs.readFileSync(OUTPUT_PATH, 'utf8');
  });

  it('should correctly output all exported Electron modules', () => {
    const AllElectronModules = getDefinitionsForInterface('Main').concat(
      getDefinitionsForInterface('Common'),
      getDefinitionsForInterface('Renderer'),
    );
    const knownElectronModules = [
      'const clipboard:',
      'const app:',
      'const autoUpdater:',
      'const dialog:',
      'const ipcMain:',
      'class Menu ',
      'class MenuItem ',
      'const webContents:',
      'class BrowserWindow ',
    ];
    for (const knownModule of knownElectronModules) {
      expect(AllElectronModules.some((tModule) => tModule.indexOf(knownModule) === 0)).toEqual(
        true,
      );
    }
  });

  it('should not output classes that are not exported Electron modules', () => {
    const AllElectronModules = getDefinitionsForInterface('Main').concat(
      getDefinitionsForInterface('Common'),
      getDefinitionsForInterface('Renderer'),
    );
    const unKnownElectronModules = [
      'class Clipboard ',
      'class CrashReport ',
      'class WebContents ',
      'const menu:',
      'class Session ',
    ];
    for (const unknownModule of unKnownElectronModules) {
      expect(AllElectronModules.some((tModule) => tModule.indexOf(unknownModule) === 0)).toEqual(
        false,
      );
    }
  });
});
