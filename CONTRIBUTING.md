# Contributing to electron/typescript-definitions

## Code of Conduct

This project adheres to Electron's [code of conduct](https://github.com/electron/electron/blob/main/CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to coc@electronjs.org.

## Developing Locally

Building locally to try out changes can be done this way:

```sh
$ git clone git@github.com:electron/typescript-definitions.git
$ cd typescript-definitions
$ yarn install
$ # make your changes...
$ yarn build
```

To run it, first you'll need a `electron-api.json` file. There are a few common ways to get this:

From a [electron/docs-parser](https://github.com/electron/docs-parser) repo (since working on this often goes hand-in-hand wth typescript-definitions):

```sh
$ cd docs-parser
$ yarn install
$ yarn build && node dist/bin.js --dir /path/to/electron-gn/src/electron --moduleVersion 1.2.3
```

From a [electron/electron](https://github.com/electron/electron/) repo:

```sh
$ cd /path/to/electron-gn/src/electron
$ npm install
$ npm run create-api-json
```

Either way, once you have `electron-api.json`, run it through the typescript generator:

```sh
$ cd typescript-definitions
$ yarn build && node dist/bin.js --api /path/to/electron-api.json
```
