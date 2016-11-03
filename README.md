# electron-DefinitelyTyped [![Build Status](https://travis-ci.org/MarshallOfSound/electron-DefinitelyTyped.svg?branch=master)](https://travis-ci.org/MarshallOfSound/electron-DefinitelyTyped)

Parse Electron's JSON API documentation and spit out a typescript definition file

## Installation

```sh
npm install electron-DefinitelyTyped --save
```

## CLI Usage

To generate the definitions

```sh
electron-DefinitelyTyped --in=path/to/electron/api.json --out=path/to/electron.d.ts
```

Any warnings during the generation can normally be ignored unless it actually throws
an error

## Programmatic Usage

The module exports a function that parses a given API JSON object and returns
an array of lines to create the definition file

```js
const generateDefinitions = require('electron-DefinitelyTyped')
const apiPath = './vendor/electron/docs/api.json'

const definitionLines = generateDefinitions(require(apiPath))
// definitionLines will be an array of file lines
```

## License

MIT
