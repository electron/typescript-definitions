#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const fetchDocs = require('./vendor/fetch-docs')
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
  const inPath = path.resolve(process.cwd(), inFile)
  if (fs.existsSync(inPath)) {
    apiPromise = Promise.resolve(require(path.resolve(process.cwd(), inFile)))
  } else {
    apiPromise = fetchDocs(inFile)
  }
} else {
  apiPromise = fetchDocs()
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
