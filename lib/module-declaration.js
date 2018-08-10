'use strict'

const _ = require('lodash')
const paramInterfaces = require('./dynamic-param-interfaces')
const utils = require('./utils')

const modules = {}

const generateModuleDeclaration = (module, index, API) => {
  const moduleAPI = modules[_.upperFirst(module.name)] || []
  const newModule = !modules[_.upperFirst(module.name)]
  const isStaticVersion = module.type === 'Module' && API.some((tModule, tIndex) => index !== tIndex && tModule.name.toLowerCase() === module.name.toLowerCase())
  const isClass = module.type === 'Class' || isStaticVersion

  // Interface Declaration
  if (newModule) {
    if (module.type === 'Element') {
      moduleAPI.push(`interface ${_.upperFirst(module.name)} extends HTMLElement {`)
      moduleAPI.push('', `// Docs: ${module.websiteUrl}`, '')
    } else if (module.type !== 'Structure') {
      if (utils.isEmitter(module)) {
        moduleAPI.push(`${isClass ? 'class' : 'interface'} ${_.upperFirst(module.name)} extends ${module.name === 'remote' ? 'MainInterface' : 'EventEmitter'} {`)
        moduleAPI.push('', `// Docs: ${module.websiteUrl}`, '')
      } else {
        moduleAPI.push(`${isClass ? 'class' : 'interface'} ${_.upperFirst(module.name)} {`)
        moduleAPI.push('', `// Docs: ${module.websiteUrl}`, '')
      }
    } else {
      moduleAPI.push(`interface ${_.upperFirst(module.name)} {`)
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

      moduleEvent.returns.forEach((eventListenerArg, index) => {
        let argString = ''
        if (eventListenerArg.description) {
          if (index === 0) argString += `\n${indent}`
          argString += utils.wrapComment(eventListenerArg.description).map((l, i) => `${l}\n${indent}`).join('')
        }

        // This is a temporary fix
        if (moduleEvent.name === 'login' && eventListenerArg.name === 'callback' && !eventListenerArg.parameters) {
          eventListenerArg.parameters = [
            { name: 'username', type: 'String', collection: false, description: '' },
            { name: 'password', type: 'String', collection: false, description: '' }
          ]
        }

        let argType = eventListenerArg
        if (eventListenerArg.type === 'Object' && eventListenerArg.properties && eventListenerArg.properties.length) {
          // Check if we have the same structure for a different name
          argType = paramInterfaces.createParamInterface(eventListenerArg, eventListenerArg.name === 'params' ? _.upperFirst(_.camelCase(moduleEvent.name)) : undefined, _.upperFirst(_.camelCase(moduleEvent.name)))
        }

        let newType = utils.typify(argType)
        if (newType === 'Function') {
          newType = utils.genMethodString(paramInterfaces, module, eventListenerArg, eventListenerArg.parameters, null, true)
        }

        args.push(`${argString}${utils.paramify(eventListenerArg.name)}${utils.isOptional(eventListenerArg) ? '?' : ''}: ${newType}`)
      })
      listener = `(${args.join(`,\n${indent}`)}) => void`
    }

    for (let method of ['on', 'once', 'addListener', 'removeListener']) {
      moduleAPI.push(`${method}(event: '${moduleEvent.name}', listener: ${listener}): this;`)
    }
  })

  // Dom Element Events
  if (module.domEvents) {
    module.domEvents.forEach((domEvent) => {
      utils.extendArray(moduleAPI, utils.wrapComment(domEvent.description))
      let eventType = 'Event'

      if (domEvent.returns && domEvent.returns.length) {
        const fakeObject = {
          name: 'event',
          type: 'Object',
          collection: false,
          properties: [],
          extends: 'Event'
        }

        domEvent.returns.forEach((eventListenerProp, index) => {
          if (eventListenerProp.name === 'result') {
            eventListenerProp.__type = `${_.upperFirst(_.camelCase(domEvent.name))}Result`
          }
          fakeObject.properties.push(eventListenerProp)
        })

        eventType = paramInterfaces.createParamInterface(fakeObject, _.upperFirst(_.camelCase(domEvent.name)))
      }

      for (let method of ['addEventListener', 'removeEventListener']) {
        moduleAPI.push(`${method}(event: '${domEvent.name}', listener: (event: ${eventType}) => void${method === 'addEventListener' ? ', useCapture?: boolean' : ''}): this;`)
      }
    })

    // original overloads copied from HTMLElement, because they are not inherited
    moduleAPI.push(`addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any, useCapture?: boolean): void;`)
    moduleAPI.push(`addEventListener(type: string, listener: EventListenerOrEventListenerObject, useCapture?: boolean): void;`)
    moduleAPI.push(`removeEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any, useCapture?: boolean): void;`)
    moduleAPI.push(`removeEventListener(type: string, listener: EventListenerOrEventListenerObject, useCapture?: boolean): void;`)
  }

  const returnsThis = (moduleMethod) => ['on', 'once', 'removeAllListeners', 'removeListener'].includes(moduleMethod.name)

  const addMethod = (moduleMethod, prefix) => {
    if (typeof prefix === 'undefined') {
      prefix = ''
    }
    utils.extendArray(moduleAPI, utils.wrapComment(moduleMethod.description))
    let returnType = returnsThis(moduleMethod) ? 'this' : 'void'

    if (moduleMethod.returns) {
      returnType = moduleMethod.returns
      // Account for methods on the process module that return a custom type/structure, we need to reference the Electron namespace to use these types
      if (module.name === 'process' && moduleMethod.returns.type !== 'Object' &&
          typeof moduleMethod.returns.type === 'string') {
        returnType = `Electron.${moduleMethod.returns.type}`
      }
    }

    if (returnType === 'Object' || returnType.type === 'Object') {
      returnType = paramInterfaces.createParamInterface(moduleMethod.returns, _.upperFirst(moduleMethod.name))

      // The process module is not in the Electron namespace so we need to reference the Electron namespace to use these types
      if (module.name === 'process') {
        returnType = `Electron.${returnType}`
      }
    }

    const paramString = utils.genMethodString(paramInterfaces, module, moduleMethod, moduleMethod.parameters, moduleMethod.returns, false, module.name === 'process' ? 'Electron.' : '')

    moduleAPI.push(`${prefix}${moduleMethod.name}(${paramString})${moduleMethod.name === 'constructor' ? '' : `: ${utils.typify(returnType)}`};`)
  }

  // Class constructor
  if (module.constructorMethod) {
    addMethod(Object.assign({ name: 'constructor', _name: `${module.name}Constructor` }, module.constructorMethod))
  }

  // Static Method Declaration
  if (module.staticMethods) {
    module.staticMethods
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(m => addMethod(m, 'static '))
  }

  // Method Declaration
  if (module.methods) {
    module.methods
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(m => addMethod(m, isStaticVersion ? 'static ' : ''))
  }

  // Instance Method Declaration
  if (module.instanceMethods) {
    module.instanceMethods
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(m => addMethod(m))
  }

  // Class properties
  if (module.instanceProperties) {
    module.instanceProperties
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(prop => {
        moduleAPI.push(`${prop.name}: ${utils.typify(prop)};`)
      })
  }

  // Class Static propreties
  if (module.staticProperties) {
    module.staticProperties
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(prop => {
        if (prop.type === 'Class') {
          moduleAPI.push(`static ${prop.name}: typeof ${prop.name};`)
          generateModuleDeclaration(prop, -1, API)
        } else {
          moduleAPI.push(`static ${prop.name}: ${utils.typify(prop)};`)
        }
      })
  }

  // Structure properties
  const pseudoProperties = (module.properties || []).concat((module.attributes || []).map(attr => Object.assign({}, attr, { type: 'String' })))
  if (pseudoProperties.length) {
    pseudoProperties
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(p => {
        let paramType = p
        if (paramType.type === 'Object') {
          paramType = paramInterfaces.createParamInterface(p, '')
        }

        const isStatic = isStaticVersion ? 'static ' : ''
        const isOptional = utils.isOptional(p) ? '?' : ''
        const type = utils.typify(paramType)

        utils.extendArray(moduleAPI, utils.wrapComment(p.description))
        if (module.name === 'process' && p.name === 'versions') return

        if (p.name.match(/^\d/)) {
          // Wrap key in quotes if it starts with a number, e.g. `2d_canvas`
          moduleAPI.push(`'${isStatic}${p.name}${isOptional}': ${type};`)
        } else {
          moduleAPI.push(`${isStatic}${p.name}${isOptional}: ${type};`)
        }
      })
  }

  // Save moduleAPI for later reuse
  modules[_.upperFirst(module.name)] = moduleAPI
}

const getModuleDeclarations = () => modules

module.exports = {generateModuleDeclaration, getModuleDeclarations}
