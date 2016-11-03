require('colors')
const utils = require('./utils')
const paramInterfaces = require('./lib/dynamic-param-interfaces')
const generateMasterInterfaces = require('./lib/master-interfaces')
const moduleDeclaration = require('./lib/module-declaration')
const remapOptionals = require('./lib/remap-optionals')

module.exports = (API) => {
  const outputLines = []

  const addThing = (lines, sep) => {
    sep = sep || ''
    utils.extendArray(outputLines, lines.map((l, i) => (i === 0 || i >= lines.length - 2) ? l : `${l}${sep}`).concat(['\n']))
  }

  remapOptionals(API)
  generateMasterInterfaces(API, addThing)

  API.sort((m1, m2) => m1.name.localeCompare(m2.name)).forEach((module, index) => {
    moduleDeclaration.generateModuleDeclaration(module, index, API)
  })

  Object.keys(moduleDeclaration.getModuleDeclarations()).forEach((moduleKey) => {
    const moduleAPI = moduleDeclaration.getModuleDeclarations()[moduleKey]
    moduleAPI.push('}')
    addThing(moduleAPI.map((l, index) => (index === 0 || index === moduleAPI.length - 1) ? l : `  ${l}`))
  })

  paramInterfaces.flushParamInterfaces(API, addThing)

  return outputLines
}
