require('colors')
const _ = require('lodash')
const fs = require('fs')
const path = require('path')

const utils = require('./lib/utils')
const paramInterfaces = require('./lib/dynamic-param-interfaces')
const generateMasterInterfaces = require('./lib/master-interfaces')
const moduleDeclaration = require('./lib/module-declaration')
const remapOptionals = require('./lib/remap-optionals')

Array.prototype.includes = Array.prototype.includes || function (thing) { // eslint-disable-line
  return this.indexOf(thing) !== -1
}

// takes the predefined header and footer and wraps them around the generated files
const wrapWithHeaderAndFooter = (outputLines, electronVersion) => {
  const newOutputLines = []
  utils.extendArray(newOutputLines, fs.readFileSync(path.resolve(__dirname, 'base/base_header.ts'), 'utf8').replace('<<VERSION>>', electronVersion).split(/\r?\n/))

  newOutputLines.push('declare namespace Electron {')
  utils.extendArray(newOutputLines, fs.readFileSync(path.resolve(__dirname, 'base/base_inner.ts'), 'utf8').replace('<<VERSION>>', electronVersion).split(/\r?\n/))
  outputLines.forEach((l) => newOutputLines.push(`${_.trimEnd(`  ${l}`)}`))
  utils.extendArray(newOutputLines, ['}', ''])

  utils.extendArray(newOutputLines, fs.readFileSync(path.resolve(__dirname, 'base/base_footer.ts'), 'utf8').replace('<<VERSION>>', electronVersion).split(/\r?\n/))
  return newOutputLines
}

module.exports = (API) => {
  const outputLines = []

  // adds lines to output with given indentation level
  const addToOutput = (lines, indentation) => {
    indentation = indentation || ''
    utils.extendArray(outputLines, lines.map((l, i) => (i === 0 || i >= lines.length - 1) ? l : `${l}${indentation}`).concat(['\n']))
  }

  remapOptionals(API)
  generateMasterInterfaces(API, addToOutput)

  // generate module declaration for every class, module, structure, element, etc
  API.sort((m1, m2) => m1.name.localeCompare(m2.name)).forEach((module, index) => {
    moduleDeclaration.generateModuleDeclaration(module, index, API)
  })

  // fetch everything that's been made and pop it into the actual API
  Object.keys(moduleDeclaration.getModuleDeclarations()).forEach((moduleKey) => {
    const moduleAPI = moduleDeclaration.getModuleDeclarations()[moduleKey]
    moduleAPI.push('}')
    addToOutput(moduleAPI.map((l, index) => (index === 0 || index === moduleAPI.length - 1) ? l : `  ${l}`))
  })

  paramInterfaces.flushParamInterfaces(API, addToOutput)

  return wrapWithHeaderAndFooter(outputLines, API[0].version)
}
