declare module 'electron' {
  export = Electron;
}

declare module 'electron/browser' {
  const api: Electron.MainInterface
  export = api
}

declare module 'electron/common' {
  const api: Electron.CommonInterface
  export = api
}

declare module 'electron/renderer' {
  const api: Electron.RendererInterface
  export = api
}

interface NodeRequireFunction {
  (moduleName: 'electron'): typeof Electron;
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

interface Document {
  createElement(tagName: 'webview'): Electron.WebviewTag;
}