const _ = require('lodash')
const fs = require('fs')
const { extendArray, isEmitter, isOptional, paramify, typify, wrapComment } = require('./utils')


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

// Remap optionals to actually be multiple methods when appropriate
API.forEach((module) => {
  const remap = (attr) => {
    const moreMethods = []
    module[attr] ? module[attr].forEach((method) => {
      if (!method.parameters) return
      if (method.__handled) return
      let optionalFound = false
      _.concat([], method.parameters).forEach((param, index) => {
        if (optionalFound && !isOptional(param)) {
          console.log('Duplicating method due to prefixed optional:', method.name, 'Slicing at:', index)
          moreMethods.push(Object.assign({}, _.cloneDeep(method), {
            parameters: [].concat(_.cloneDeep(method.parameters)).filter((tParam, pIndex) => {
              if (pIndex >= index) return true
              return !isOptional(tParam)
            })
          }))
          for (let i = 0; i < index; i++) {
            if (method.parameters[i].description) {
              method.parameters[i].description = method.parameters[i].description.replace(/\(optional\)/gi, '')
            }
          }
          method.__handled = true
        }
        optionalFound = optionalFound || isOptional(param)
      })
    }) : null
    moreMethods.forEach((newMethod) => module[attr].push(newMethod))
  }
  remap('methods')
  remap('instanceMethods')
  remap('staticMethods')
})

// Generate Main / Renderer process interfaces
let CommonInterface = ['interface CommonInterface {']
let MainInterface = ['interface MainInterface extends CommonInterface {']
let RendererInterface = ['interface RendererInterface extends CommonInterface {']
let ElectronMainAndRendererInterface = ['interface AllElectron {']
const EMRI = {}

API.forEach((module) => {
  let TargetInterface
  const moduleString = `  ${module.name}: Electron.${_.upperFirst(module.name)}`
  if (module.process.main && module.process.renderer) {
    TargetInterface = CommonInterface
  } else if (module.process.main) {
    TargetInterface = MainInterface
  } else if (module.process.renderer) {
    TargetInterface = RendererInterface
  }
  if (!EMRI[module.name.toLowerCase()]) ElectronMainAndRendererInterface.push(moduleString)
  EMRI[module.name.toLowerCase()] = true
  TargetInterface.push(moduleString)
})

CommonInterface.push('}')
MainInterface.push('}')
RendererInterface.push('}')
ElectronMainAndRendererInterface.push('}')

addThing([''])
addThing(CommonInterface, ',')
addThing(MainInterface, ',')
addThing(RendererInterface, ',')
addThing(ElectronMainAndRendererInterface, ',')

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

API.sort((m1, m2) => m1.name.localeCompare(m2.name)).forEach((module, index) => {
  const moduleAPI = modules[_.upperFirst(module.name)] || []
  const newModule = !modules[_.upperFirst(module.name)]
  const isStaticVersion = module.type === 'Module' && API.some((tModule, tIndex) => index !== tIndex && tModule.name.toLowerCase() === module.name.toLowerCase())
  const isClass = module.type === 'Class' || isStaticVersion
  // Interface Declaration
  if (newModule) {
    if (module.type !== 'Structure') {
      if (isEmitter(module.name)) {
        moduleAPI.push(`${isClass ? 'class' : 'interface'} ${_.upperFirst(module.name)} extends ${module.name === 'remote' ? 'MainInterface' : 'EventEmitter'} {`)
        moduleAPI.push('', `// Docs: ${module.websiteUrl}`, '', 'on(event: string, listener: Function): this;', '')
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
        if (moduleEventListenerArg.type === 'Object' && moduleEventListenerArg.properties) {
          // Check if we have the same structure for a different name
          argType = createParamInterface(moduleEventListenerArg, moduleEventListenerArg.name === 'params' ? _.upperFirst(_.camelCase(moduleEvent.name)) : undefined, _.upperFirst(_.camelCase(moduleEvent.name)))
        }
        args.push(`${argString}${paramify(moduleEventListenerArg.name)}: ${typify(argType)}`)
      })
      listener = `(${args.join(`,\n${indent}`)}) => void`
    }
    moduleAPI.push(`on(event: "${moduleEvent.name}", listener: ${listener}): this;`)
  })
  // Method Handler
  const addMethod = (moduleMethod, prefix = '') => {
    extendArray(moduleAPI, wrapComment(moduleMethod.description))
    let returnType = 'void'
    if (moduleMethod.returns && moduleMethod.returns.type !== 'undefined') {
      returnType = moduleMethod.returns.type
    }
    moduleAPI.push(`${prefix}${moduleMethod.name}(${(moduleMethod.parameters || []).map((param) => {
      let paramType = param.type
      if (param.type === 'Object' && param.properties) {
        // Check if we have the same structure for a different name
        if (param.name === 'options') {
          paramType = createParamInterface(param, _.upperFirst(moduleMethod._name || moduleMethod.name))
        } else {
          paramType = createParamInterface(param, _.upperFirst(moduleMethod._name) || '', _.upperFirst(moduleMethod.name))
        }
      }
      return `${paramify(param.name)}${isOptional(param) ? '?' : ''}: ${
        param.possibleValues && param.possibleValues.length
        ? param.possibleValues.map(v => `'${v.value}'`).join(' | ')
        : typify(paramType)
      }`
    }).join(', ')})${moduleMethod.name === 'constructor' ? '' : `: ${typify(returnType)}`};`)
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
    // FIXME: The docs need prop types before we can specify the type here
    moduleAPI.push(`${prop.name}: any;`)
  }) : null
  // Structure properties
  module.properties ? module.properties.sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
    moduleAPI.push(`${p.name}: ${p.type};`)
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
    paramAPI.push(`${paramProperty.name}: ${typify(paramProperty.type)};`)
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

outStream.write(fs.readFileSync('./base_header.ts', 'utf8').replace('<<VERSION>>', require('./package.json').version))

outStream.write('declare namespace Electron {\n')
outStream.write(fs.readFileSync('./base_inner.ts', 'utf8').replace('<<VERSION>>', require('./package.json').version))
outputLines.forEach((l) => outStream.write(`${_.trimEnd(`  ${l}`)}\n`))
outStream.write('}\n\n')

outStream.write(fs.readFileSync('./base_footer.ts', 'utf8').replace('<<VERSION>>', require('./package.json').version))

// outStream.close && outStream.close()
