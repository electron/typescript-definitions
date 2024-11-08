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

declare module 'electron/utility' {
  export = Electron.Utility;
}

interface NodeRequireFunction {
  (moduleName: 'electron'): typeof Electron.CrossProcessExports;
  (moduleName: 'electron/main'): typeof Electron.Main;
  (moduleName: 'electron/common'): typeof Electron.Common;
  (moduleName: 'electron/renderer'): typeof Electron.Renderer;
  (moduleName: 'electron/utility'): typeof Electron.Utility;
}

interface NodeRequire {
  (moduleName: 'electron'): typeof Electron.CrossProcessExports;
  (moduleName: 'electron/main'): typeof Electron.Main;
  (moduleName: 'electron/common'): typeof Electron.Common;
  (moduleName: 'electron/renderer'): typeof Electron.Renderer;
  (moduleName: 'electron/utility'): typeof Electron.Utility;
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
