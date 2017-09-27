declare module 'electron' {
  export = Electron;
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