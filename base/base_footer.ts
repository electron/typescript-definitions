declare module 'electron' {
  const electron: Electron.AllElectron;
  export = electron;
}

interface NodeRequireFunction {
  (moduleName: 'electron'): Electron.AllElectron;
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