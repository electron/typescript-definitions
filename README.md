# Electron TypeScript Definitions [![Build Status](https://travis-ci.org/electron/electron-typescript-definitions.svg?branch=master)](https://travis-ci.org/electron/electron-typescript-definitions)

This module uses Electron's [JSON API documentation](https://electron.atom.io/blog/2016/09/27/api-docs-json-schema) to produce a TypeScript definition file for the Electron API.

## Installation

```sh
npm install electron-typescript-definitions --save
```

## CLI Usage

To generate the definitions

```sh
electron-typescript-definitions --in=path/to/electron/api.json --out=path/to/electron.d.ts
```

Any warnings during the generation can normally be ignored unless it actually throws
an error

## Programmatic Usage

The module exports a function that parses a given API JSON object and returns
an array of lines to create the definition file

```js
const generateDefinitions = require('electron-typescript-definitions')
const apiPath = './vendor/electron/docs/api.json'

const definitionLines = generateDefinitions(require(apiPath))
// definitionLines will be an array of file lines
```

## License

MIT
