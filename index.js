const _ = require('lodash')
const fs = require('fs')

const API = require('./electron-api-docs/electron-api.json')

let outFile
process.argv.forEach((arg) => {
  if (arg.startsWith('-o=')) {
    outFile = arg.substring(3)
  } else if (arg.startsWith('--out=')) {
    outFile = arg.substring(6)
  }
})

const outputLines = []

const extendArray = (arr1, arr2) => Array.prototype.push.apply(arr1, arr2)
const addThing = (lines) => extendArray(outputLines, lines.concat(['\n']))
const wrapComment = (comment) => {
  if (!comment) return []
  const result = ['/**']
  while (comment.trim().length > 0) {
    let index = 0
    for (let i = 0; i <= 80; i++) {
      if (comment[i] === ' ') index = i
    }
    if (comment.length <= 80) {
      index = 80
    }
    result.push(` * ${comment.substring(0, index)}`)
    comment = comment.substring(index + 1)
  }
  return result.concat(' */')
}

// Generate Main / Renderer process interfaces
let CommonInterface = ['interface CommonInterface {']
let MainInterface = ['interface MainInterface extends CommonInterface {']
let RendererInterface = ['interface RendererInterface extends CommonInterface {']
let ElectronMainAndRendererInterface = ['interface ElectronMainAndRenderer {']

API.forEach((module) => {
  let TargetInterface
  const moduleString = `  ${module.name}: Electron.${_.upperFirst(module.name)},`
  if (module.process.main && module.process.renderer) {
    TargetInterface = CommonInterface
  } else if (module.process.main) {
    TargetInterface = MainInterface
  } else if (module.process.renderer) {
    TargetInterface = RendererInterface
  }
  ElectronMainAndRendererInterface.push(moduleString)
  TargetInterface.push(moduleString)
})

CommonInterface.push('}')
MainInterface.push('}')
RendererInterface.push('}')
ElectronMainAndRendererInterface.push('}')

addThing(CommonInterface)
addThing(MainInterface)
addThing(RendererInterface)
addThing(ElectronMainAndRendererInterface)

const modules = {}
const paramInterfacesToDeclare = {}

const impoliteInterfaceNames = ['Get', 'Set', 'Show']
const polite = (s) => {
  for (let i = 0; i < impoliteInterfaceNames.length; i++) {
    if (s.startsWith(impoliteInterfaceNames[i])) return polite(s.substring(impoliteInterfaceNames[i].length))
  }
  return s
}

const createParamInterface = (param, IName = '', backupIName = '') => {
  let argType = polite(IName) + _.upperFirst(_.camelCase(param.name))
  let argName = param.name
  // FIXME: Either the docs need to have consistent param names
  //        Or we need to handle the newDisplay, oldDisplay case being the same
  //        Interface.  Not sure how to handle this as handling the name results
  //        in On***Options being considered duplicates :'(

  // Object.keys(paramInterfacesToDeclare).forEach((tParamName) => {
  //   if (_.isEqual(paramInterfacesToDeclare[tParamName].properties, param.properties) && (
  //       paramInterfacesToDeclare[tParamName].name.toLowerCase().includes(param.name.toLowerCase()) ||
  //       param.name.toLowerCase().includes(paramInterfacesToDeclare[tParamName].name.toLowerCase())
  //     )) {
  //     // Always take the shorter name (cos logic)
  //     argType = param.type.length < tParamName.length ? argType : tParamName
  //     argName = param.name.length < paramInterfacesToDeclare[tParamName].name.length ? param.name : paramInterfacesToDeclare[tParamName].name
  //     console.log('Deleting: ', tParamName)
  //     delete paramInterfacesToDeclare[tParamName]
  //   }
  // })
  if (paramInterfacesToDeclare[argType] && !_.isEqual(paramInterfacesToDeclare[argType].properties, param.properties)) {
    if (backupIName) {
      return createParamInterface(param, backupIName)
    }
    console.error(paramInterfacesToDeclare[argType])
    throw Error(`Interface "${argType}" has already been declared`)
  }
  // Update the params interfaces we still have to define
  paramInterfacesToDeclare[argType] = param
  paramInterfacesToDeclare[argType].name = argName
  paramInterfacesToDeclare[argType].tName = argType
  return argType
}

API.forEach((module, index) => {
  const moduleAPI = modules[_.upperFirst(module.name)] || []
  const newModule = !modules[_.upperFirst(module.name)]
  const isStaticVersion = module.type === 'Module' && API.some((tModule, tIndex) => index !== tIndex && tModule.name.toLowerCase() === module.name.toLowerCase())
  // Interface Declaration
  if (newModule) {
    moduleAPI.push(`interface ${_.upperFirst(module.name)} extends ${module.name === 'remote' ? 'MainInterface' : 'NodeJS.EventEmitter'} {`)
    moduleAPI.push('', `// Docs: ${module.websiteUrl}`, '')
  }
  // Event Declaration
  _.concat([], module.instanceEvents || [], module.events || []).sort((a, b) => a.name.localeCompare(b.name)).forEach((moduleEvent) => {
    extendArray(moduleAPI, wrapComment(moduleEvent.description))
    let listener = 'Function'
    if (moduleEvent.returns.length) {
      const args = []
      const indent = _.repeat(' ', moduleEvent.name.length + 29)
      moduleEvent.returns.forEach((moduleEventListenerArg) => {
        let argString = ''
        if (moduleEventListenerArg.description) {
          argString += wrapComment(moduleEventListenerArg.description).map((l, i) => `${l}\n${indent}`).join('')
        }
        let argType = moduleEventListenerArg.type
        if (moduleEventListenerArg.type === 'Object' && moduleEventListenerArg.properties) {
          // Check if we have the same structure for a different name
          argType = createParamInterface(moduleEventListenerArg, moduleEventListenerArg.name === 'params' ? _.upperFirst(_.camelCase(moduleEvent.name)) : undefined, _.upperFirst(_.camelCase(moduleEvent.name)))
        }
        args.push(`${argString}${moduleEventListenerArg.name}: ${argType}`)
      })
      listener = `(${args.join(`,\n${indent}`)}) => void`
    }
    moduleAPI.push(`on(event: "${moduleEvent.name}", listener: ${listener}): this;`)
  })
  // Method Handler
  const addMethod = (moduleMethod, prefix = '') => {
    extendArray(moduleAPI, wrapComment(moduleMethod.description))
    moduleAPI.push(`${prefix}${moduleMethod.name}(${moduleMethod.parameters.map((param) => {
      let paramType = param.type
      if (param.type === 'Object' && param.properties) {
        // Check if we have the same structure for a different name
        if (param.name === 'options') {
          paramType = createParamInterface(param, _.upperFirst(moduleMethod.name))
        } else {
          paramType = createParamInterface(param, '', _.upperFirst(moduleMethod.name))
        }
      }
      return `${param.name}${/optional/gi.test(param.description) ? '?' : ''}: ${
        param.possibleValues && param.possibleValues.length
        ? param.possibleValues.map(v => `"${v}"`).join(',')
        : paramType
      }`
    }).join(', ')}): void;`)
  }
  // Method Declaration
  module.methods ? module.methods.sort((a, b) => a.name.localeCompare(b.name)).forEach(m => addMethod(m, isStaticVersion ? 'static ' : '')) : null
  // Instance Method Declaration
  module.instanceMethods ? module.instanceMethods.sort((a, b) => a.name.localeCompare(b.name)).forEach(m => addMethod(m)) : null
  // Static Method Declaration
  module.staticMethods ? module.staticMethods.sort((a, b) => a.name.localeCompare(b.name)).forEach(m => addMethod(m, 'static ')) : null
  module.instanceProperties ? module.instanceProperties.sort((a, b) => a.name.localeCompare(b.name)).forEach(prop => {
    // FIXME: The docs need prop types before we can specify the type here
    moduleAPI.push(`${prop.name}: any;`)
  }) : null
  // Save moduleAPI for later reuse
  modules[_.upperFirst(module.name)] = moduleAPI
})

Object.keys(modules).forEach((moduleKey) => {
  const moduleAPI = modules[moduleKey]
  moduleAPI.push('}')
  addThing(moduleAPI.map((l, index) => (index === 0 || index === moduleAPI.length - 1) ? l : `  ${l}`))
})

Object.keys(paramInterfacesToDeclare).sort((a, b) => paramInterfacesToDeclare[a].tName.localeCompare(paramInterfacesToDeclare[b].tName)).forEach((paramKey) => {
  const param = paramInterfacesToDeclare[paramKey]
  const paramAPI = []
  paramAPI.push(`interface ${_.upperFirst(param.tName)} {`)
  param.properties.forEach((paramProperty) => {
    if (paramProperty.description) {
      extendArray(paramAPI, wrapComment(paramProperty.description))
    }
    paramAPI.push(`${paramProperty.name}: ${paramProperty.type};`)
  })
  paramAPI.push('}')
  // console.log(paramAPI)
  addThing(paramAPI.map((l, index) => (index === 0 || index === paramAPI.length - 1) ? l : `  ${l}`))
})

// process.exit(0)
let outStream = process.stdout
if (outFile) {
  outStream = fs.createWriteStream(outFile)
}
outStream.write('declare namespace Electron {\n')
outputLines.forEach((l) => outStream.write(`${l.trim().length ? '  ' : ''}${l.trim()}\n`))
outStream.write('}\n\n')

outStream.write(fs.readFileSync('./raw_base.ts', 'utf8').replace('<<VERSION>>', require('./package.json').version))

// outStream.close && outStream.close()
