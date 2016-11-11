#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
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

let apiPromise
if (inFile) {
  apiPromise = Promise.resolve(require(path.resolve(process.cwd(), inFile)))
} else {
  apiPromise = require('./vendor/fetch-docs')
}

apiPromise.then(API => {
  return JSON.parse(JSON.stringify(API))
}).then(API => {
  let outStream = process.stdout
  if (outFile) {
    outStream = fs.createWriteStream(path.resolve(process.cwd(), outFile))
  }

  generateTypings(API).forEach(line => outStream.write(`${line}\n`))
})
