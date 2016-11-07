'use strict'

const _ = require('lodash')
const paramInterfaces = require('./dynamic-param-interfaces')
const utils = require('../utils')

const modules = {}

const generateModuleDeclaration = (module, index, API) => {
  const moduleAPI = modules[_.upperFirst(module.name)] || []
  const newModule = !modules[_.upperFirst(module.name)]
  const isStaticVersion = module.type === 'Module' && API.some((tModule, tIndex) => index !== tIndex && tModule.name.toLowerCase() === module.name.toLowerCase())
  const isClass = module.type === 'Class' || isStaticVersion
  // Interface Declaration
  if (newModule) {
    if (module.type !== 'Structure') {
      if (utils.isEmitter(module)) {
        moduleAPI.push(`${isClass ? 'class' : 'interface'} ${_.upperFirst(module.name)} extends ${module.name === 'remote' ? 'MainInterface' : 'EventEmitter'} {`)
        moduleAPI.push('', `// Docs: ${module.websiteUrl}`, '')
      } else {
        moduleAPI.push(`${isClass ? 'class' : 'interface'} ${_.upperFirst(module.name)} {`)
        moduleAPI.push('', `// Docs: ${module.websiteUrl}`, '')
      }
    } else {
      moduleAPI.push(`type ${_.upperFirst(module.name)} = {`)
      moduleAPI.push('', `// Docs: ${module.websiteUrl}`, '')
    }
  }

  // Event Declaration
  _.concat([], module.instanceEvents || [], module.events || []).sort((a, b) => a.name.localeCompare(b.name)).forEach((moduleEvent) => {
    utils.extendArray(moduleAPI, utils.wrapComment(moduleEvent.description))
    let listener = 'Function'
    if (moduleEvent.returns && moduleEvent.returns.length) {
      const args = []
      const indent = _.repeat(' ', moduleEvent.name.length + 29)
      moduleEvent.returns.forEach((moduleEventListenerArg) => {
        let argString = ''
        if (moduleEventListenerArg.description) {
          argString += utils.wrapComment(moduleEventListenerArg.description).map((l, i) => `${l}\n${indent}`).join('')
        }
        let argType = moduleEventListenerArg.type
        if (moduleEventListenerArg.type === 'Object' && moduleEventListenerArg.properties && moduleEventListenerArg.properties.length) {
          // Check if we have the same structure for a different name
          argType = paramInterfaces.createParamInterface(moduleEventListenerArg, moduleEventListenerArg.name === 'params' ? _.upperFirst(_.camelCase(moduleEvent.name)) : undefined, _.upperFirst(_.camelCase(moduleEvent.name)))
        }
        args.push(`${argString}${utils.paramify(moduleEventListenerArg.name)}${utils.isOptional(moduleEventListenerArg) ? '?' : ''}: ${utils.typify(argType)}`)
      })
      listener = `(${args.join(`,\n${indent}`)}) => void`
    }
    moduleAPI.push(`on(event: '${moduleEvent.name}', listener: ${listener}): this;`)
  })

  const returnsThis = (moduleMethod) => ['on', 'once', 'removeAllListeners', 'removeListener'].includes(moduleMethod.name)

  const addMethod = (moduleMethod, prefix) => {
    prefix = prefix || ''
    utils.extendArray(moduleAPI, utils.wrapComment(moduleMethod.description))
    let returnType = returnsThis(moduleMethod) ? 'this' : 'void'
    if (moduleMethod.returns && moduleMethod.returns.type !== 'undefined') {
      returnType = moduleMethod.returns.type
    }
    if (returnType === 'Object') {
      returnType = paramInterfaces.createParamInterface(moduleMethod.returns, _.upperFirst(moduleMethod.name));
    }
    moduleAPI.push(`${prefix}${moduleMethod.name}(${utils.genMethodString(paramInterfaces, module, moduleMethod, moduleMethod.parameters, moduleMethod.returns, false)})${moduleMethod.name === 'constructor' ? '' : `: ${utils.typify(returnType)}`};`)
  }
  // Class constructor
  module.constructorMethod ? [module.constructorMethod].forEach(m => {
    addMethod(Object.assign({ name: 'constructor', _name: `${module.name}Constructor` }, m))
  }) : null
  // Static Method Declaration
  module.staticMethods ? module.staticMethods.sort((a, b) => a.name.localeCompare(b.name)).forEach(m => addMethod(m, 'static ')) : null
  // Method Declaration
  module.methods ? module.methods.sort((a, b) => a.name.localeCompare(b.name)).forEach(m => addMethod(m, isStaticVersion ? 'static ' : '')) : null
  // Instance Method Declaration
  module.instanceMethods ? module.instanceMethods.sort((a, b) => a.name.localeCompare(b.name)).forEach(m => addMethod(m)) : null
  // Class properties
  module.instanceProperties ? module.instanceProperties.sort((a, b) => a.name.localeCompare(b.name)).forEach(prop => {
    moduleAPI.push(`${prop.name}: ${utils.typify(prop.type)};`)
  }) : null
  // Structure properties
  module.properties ? module.properties.sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
    let paramType = p.type
    if (paramType === 'Object') {
      paramType = paramInterfaces.createParamInterface(p, '')
    }
    moduleAPI.push(`${isStaticVersion ? 'static ' : ''}${p.name}${utils.isOptional(p) ? '?' : ''}: ${utils.typify(paramType)};`)
  }) : null
  // Save moduleAPI for later reuse
  modules[_.upperFirst(module.name)] = moduleAPI
}

const getModuleDeclarations = () => modules

module.exports = {
  generateModuleDeclaration,
  getModuleDeclarations
}
