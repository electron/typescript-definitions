# Contributing to electron-typescript-definitions

## Code of Conduct

This project adheres to Electron's [code of conduct](https://github.com/electron/electron/blob/master/CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to coc@electronjs.org.

## Developing Locally

Building locally to try out changes can be done this way:

```sh
$ git clone git@github.com:electron/typescript-definitions.git
$ cd typescript-definitions
$ yarn install
$ # make your changes...
$ yarn build
```

To test with a pre-generated json file, e.g. from running `npm run create-api-json` from an [Electron repository](https://github.com/electron/electron/):

```sh
$ cd typescript-definitions
$ yarn build && node dist/bin.js --api /path/to/electron-gn/src/electron/electron-api.json
```

If you want to test the docs parser as well:

```sh
$ cd typescript-definitions
$ yarn build && node dist/bin.js --dir /path/to/electron-gn/src/electron
￼
```
