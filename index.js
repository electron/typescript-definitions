require('colors')
const { extendArray } = require('./utils')
const { flushParamInterfaces } = require('./lib/dynamic-param-interfaces')
const generateMasterInterfaces = require('./lib/master-interfaces')
const { generateModuleDeclaration, getModuleDeclarations } = require('./lib/module-declaration')
const remapOptionals = require('./lib/remap-optionals')

module.exports = (API) => {
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

  return outputLines
}
