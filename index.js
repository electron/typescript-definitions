require('colors')
const _ = require('lodash')
const fs = require('fs')
const { extendArray } = require('./utils')
const { flushParamInterfaces } = require('./lib/dynamic-param-interfaces')
const generateMasterInterfaces = require('./lib/master-interfaces')
const { generateModuleDeclaration, getModuleDeclarations } = require('./lib/module-declaration')
const remapOptionals = require('./lib/remap-optionals')

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
const outputLines = []

const addThing = (lines, sep = '') => extendArray(outputLines, lines.map((l, i) => (i === 0 || i >= lines.length - 2) ? l : `${l}${sep}`).concat(['\n']))

remapOptionals(API)
generateMasterInterfaces(API, addThing)

API.sort((m1, m2) => m1.name.localeCompare(m2.name)).forEach((module, index) => {
  generateModuleDeclaration(module, index, API)
})

Object.keys(getModuleDeclarations()).forEach((moduleKey) => {
  const moduleAPI = getModuleDeclarations()[moduleKey]
  moduleAPI.push('}')
  addThing(moduleAPI.map((l, index) => (index === 0 || index === moduleAPI.length - 1) ? l : `  ${l}`))
})

flushParamInterfaces(API, addThing)

// process.exit(0)
let outStream = process.stdout
if (outFile) {
  outStream = fs.createWriteStream(outFile)
}

outStream.write(fs.readFileSync('./base_header.ts', 'utf8').replace('<<VERSION>>', require('./package.json').version))

outStream.write('declare namespace Electron {\n')
outStream.write(fs.readFileSync('./base_inner.ts', 'utf8').replace('<<VERSION>>', require('./package.json').version))
outputLines.forEach((l) => outStream.write(`${_.trimEnd(`  ${l}`)}\n`))
outStream.write('}\n\n')

outStream.write(fs.readFileSync('./base_footer.ts', 'utf8').replace('<<VERSION>>', require('./package.json').version))

// outStream.close && outStream.close()
