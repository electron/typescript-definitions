#!/usr/bin/env node
'use strict'

const _ = require('lodash')
const fs = require('fs')
const generateTypings = require('./')

let outFile
let inFile
process.argv.forEach((arg) => {
  if (arg.startsWith('-o=')) {
    outFile = arg.substring(3)
  } else if (arg.startsWith('--out=')) {
    outFile = arg.substring(6)
  }
  if (arg.startsWith('-i=')) {
    inFile = arg.substring(3)
  } else if (arg.startsWith('--in=')) {
    inFile = arg.substring(5)
  }
})

let API = require('./electron-api-docs/electron-api.json')
if (inFile) {
  API = require(inFile)
}

const outputLines = generateTypings(API)

let outStream = process.stdout
if (outFile) {
  outStream = fs.createWriteStream(outFile)
}

outStream.write(fs.readFileSync('./base/base_header.ts', 'utf8').replace('<<VERSION>>', require('./package.json').version))

outStream.write('declare namespace Electron {\n')
outStream.write(fs.readFileSync('./base/base_inner.ts', 'utf8').replace('<<VERSION>>', require('./package.json').version))
outputLines.forEach((l) => outStream.write(`${_.trimEnd(`  ${l}`)}\n`))
outStream.write('}\n\n')

outStream.write(fs.readFileSync('./base/base_footer.ts', 'utf8').replace('<<VERSION>>', require('./package.json').version))
