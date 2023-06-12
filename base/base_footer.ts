declare module 'electron' {
  export = Electron.CrossProcessExports;
}

declare module 'electron/main' {
  export = Electron.Main;
}

declare module 'electron/common' {
  export = Electron.Common;
}

declare module 'electron/renderer' {
  export = Electron.Renderer;
}

interface NodeRequireFunction {
  (moduleName: 'electron'): typeof Electron.CrossProcessExports;
  (moduleName: 'electron/main'): typeof Electron.Main;
  (moduleName: 'electron/common'): typeof Electron.Common;
  (moduleName: 'electron/renderer'): typeof Electron.Renderer;
}

interface NodeRequire {
  (moduleName: 'electron'): typeof Electron.CrossProcessExports;
  (moduleName: 'electron/main'): typeof Electron.Main;
  (moduleName: 'electron/common'): typeof Electron.Common;
  (moduleName: 'electron/renderer'): typeof Electron.Renderer;
}

interface File {
  /**
   * The real path to the file on the users filesystem
   */
  path: string;
}

declare module 'original-fs' {
  import * as fs from 'fs';
  export = fs;
}

declare module 'node:original-fs' {
  import * as fs from 'fs';
  export = fs;
}

interface Document {
  createElement(tagName: 'webview'): Electron.WebviewTag;
}
