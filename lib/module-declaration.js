const _ = require('lodash')
const { createParamInterface } = require('./dynamic-param-interfaces')
const { extendArray, isEmitter, isOptional, paramify, typify, wrapComment } = require('../utils')

const modules = {}

const generateModuleDeclaration = (module, index, API) => {
  const moduleAPI = modules[_.upperFirst(module.name)] || []
  const newModule = !modules[_.upperFirst(module.name)]
  const isStaticVersion = module.type === 'Module' && API.some((tModule, tIndex) => index !== tIndex && tModule.name.toLowerCase() === module.name.toLowerCase())
  const isClass = module.type === 'Class' || isStaticVersion
  // Interface Declaration
  if (newModule) {
    if (module.type !== 'Structure') {
      if (isEmitter(module)) {
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
    extendArray(moduleAPI, wrapComment(moduleEvent.description))
    let listener = 'Function'
    if (moduleEvent.returns && moduleEvent.returns.length) {
      const args = []
      const indent = _.repeat(' ', moduleEvent.name.length + 29)
      moduleEvent.returns.forEach((moduleEventListenerArg) => {
        let argString = ''
        if (moduleEventListenerArg.description) {
          argString += wrapComment(moduleEventListenerArg.description).map((l, i) => `${l}\n${indent}`).join('')
        }
        let argType = moduleEventListenerArg.type
        if (moduleEventListenerArg.type === 'Object' && moduleEventListenerArg.properties && moduleEventListenerArg.properties.length) {
          // Check if we have the same structure for a different name
          argType = createParamInterface(moduleEventListenerArg, moduleEventListenerArg.name === 'params' ? _.upperFirst(_.camelCase(moduleEvent.name)) : undefined, _.upperFirst(_.camelCase(moduleEvent.name)))
        }
        args.push(`${argString}${paramify(moduleEventListenerArg.name)}${isOptional(moduleEventListenerArg) ? '?' : ''}: ${typify(argType)}`)
      })
      listener = `(${args.join(`,\n${indent}`)}) => void`
    }
    moduleAPI.push(`on(event: "${moduleEvent.name}", listener: ${listener}): this;`)
  })

  // Method Handler
  const genMethodString = (moduleMethod, parameters, includeType = true) => {
    return `${includeType ? '(' : ''}${(parameters || []).map((param) => {
      let paramType = param.type
      if (param.type === 'Object' && param.properties && param.properties.length) {
        // Check if we have the same structure for a different name
        if (param.name === 'options') {
          paramType = createParamInterface(param, _.upperFirst(moduleMethod._name || moduleMethod.name))
        } else {
          paramType = createParamInterface(param, _.upperFirst(moduleMethod._name) || '', _.upperFirst(moduleMethod.name))
        }
      }
      if (param.type === 'Function' && param.parameters) {
        paramType = genMethodString(moduleMethod, param.parameters)
      }
      return `${paramify(param.name)}${isOptional(param) ? '?' : ''}: ${
        param.possibleValues && param.possibleValues.length
        ? param.possibleValues.map(v => `'${v.value}'`).join(' | ')
        : typify(paramType)
      }`
    }).join(', ')}${includeType ? `) => void` : ''}`
  }

  const addMethod = (moduleMethod, prefix = '') => {
    extendArray(moduleAPI, wrapComment(moduleMethod.description))
    let returnType = 'void'
    if (moduleMethod.returns && moduleMethod.returns.type !== 'undefined') {
      returnType = moduleMethod.returns.type
    }
    moduleAPI.push(`${prefix}${moduleMethod.name}(${genMethodString(moduleMethod, moduleMethod.parameters, false)})${moduleMethod.name === 'constructor' ? '' : `: ${typify(returnType)}`};`)
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
    moduleAPI.push(`${prop.name}: ${typify(prop.type)};`)
  }) : null
  // Structure properties
  module.properties ? module.properties.sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
    moduleAPI.push(`${p.name}: ${typify(p.type)};`)
  }) : null
  // Save moduleAPI for later reuse
  modules[_.upperFirst(module.name)] = moduleAPI
}

const getModuleDeclarations = () => modules

module.exports = {
  generateModuleDeclaration,
  getModuleDeclarations
}
