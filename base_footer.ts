declare module 'electron' {
  const electron: Electron.AllElectron;
  export = electron;
}

interface NodeRequireFunction {
  (moduleName: 'electron'): Electron.AllElectron;
}
