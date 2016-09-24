declare module 'electron' {
  const electron: Electron.ElectronMainAndRenderer;
  export = electron;
}

interface NodeRequireFunction {
  (moduleName: 'electron'): Electron.ElectronMainAndRenderer;
}

// Type definitions for Electron <<VERSION>>
// Project: http://electron.atom.io/
