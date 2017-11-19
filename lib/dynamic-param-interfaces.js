'use strict'

const _ = require('lodash')
const utils = require('./utils')
const debug = require('debug')('dynamic-param')

// Object of interfaces we need to declare
const paramInterfacesToDeclare = {}

// Interfaces that we would declare with these prefixes should remove them before declaration
const impoliteInterfaceNames = ['Get', 'Set', 'Show']
const polite = (s) => {
  for (let i = 0; i < impoliteInterfaceNames.length; i++) {
    if (s.startsWith(impoliteInterfaceNames[i])) return polite(s.substring(impoliteInterfaceNames[i].length))
  }
  return s
}

// Ignore descriptions when comparing objects
const ignoreDescriptions = (props) => _.map(props, p => {
  const toReturn = Object.assign({}, p, { description: undefined })
  if (toReturn.type) {
    toReturn.type = utils.typify(toReturn.type)
  }
  return toReturn
}).sort((a, b) => a.name.localeCompare(b.name))

// Given a parameter create a new interface and return it's name
// IName is the proposed interface name prefix
// backupIName is a slightly longer IName in case IName is already taken
const createParamInterface = (param, IName, backupIName) => {
  IName = IName || ''
  backupIName = backupIName || ''
  let argType = polite(IName) + _.upperFirst(_.camelCase(param.name))
  let argName = param.name
  // TODO: Note.  It is still possible for even backupIName to be already used
  let usingExistingParamInterface = false
  _.forIn(paramInterfacesToDeclare, (value, key) => {
    const test = _.assign({}, param, { name: argName, tName: argType })
    if (_.isEqual(test, value)) {
      usingExistingParamInterface = true
      debug(`Using existing type for param name ${argType} --> ${key} in Interface: ${_.upperFirst(param.tName)} --- This is because their structure is identical`.cyan)
      argType = key
      return false
    }
  })
  if (usingExistingParamInterface) {
    return argType
  }
  if (paramInterfacesToDeclare[argType] && !_.isEqual(ignoreDescriptions(paramInterfacesToDeclare[argType].properties), ignoreDescriptions(param.properties))) {
    if (backupIName) {
      return createParamInterface(param, backupIName)
    }
    console.error(ignoreDescriptions(paramInterfacesToDeclare[argType].properties), '\n', ignoreDescriptions(param.properties))
    throw Error(`Interface "${argType}" has already been declared`)
  }
  // Update the params interfaces we still have to define
  paramInterfacesToDeclare[argType] = param
  paramInterfacesToDeclare[argType].name = argName
  paramInterfacesToDeclare[argType].tName = argType
  return argType
}

const flushParamInterfaces = (API, addToOutput) => {
  const declared = {}

  while (Object.keys(paramInterfacesToDeclare).length > 0) {
    const nestedInterfacesToDeclare = {}

    Object.keys(paramInterfacesToDeclare).sort((a, b) => paramInterfacesToDeclare[a].tName.localeCompare(paramInterfacesToDeclare[b].tName)).forEach((paramKey) => {
      if (paramKey === 'Event') {
        delete paramInterfacesToDeclare[paramKey]
        return
      }
      if (declared[paramKey]) {
        const toDeclareCheck = Object.assign({}, paramInterfacesToDeclare[paramKey])
        const declaredCheck = Object.assign({}, declared[paramKey])
        for (const prop of ['type', 'collection', 'required', 'description']) {
          delete toDeclareCheck[prop]
          delete declaredCheck[prop]
        }
        if (!_.isEqual(toDeclareCheck, declaredCheck)) {
          throw new Error('Ruh roh, "' + paramKey + '" is already declared')
        }
        delete paramInterfacesToDeclare[paramKey]
        return
      }
      declared[paramKey] = paramInterfacesToDeclare[paramKey]
      const param = paramInterfacesToDeclare[paramKey]
      const paramAPI = []
      paramAPI.push(`interface ${_.upperFirst(param.tName)}${param.extends ? ` extends ${param.extends}` : ''} {`)

      param.properties = param.properties || []
      param.properties.forEach((paramProperty) => {
        if (paramProperty.description) {
          utils.extendArray(paramAPI, utils.wrapComment(paramProperty.description))
        }

        if (!Array.isArray(paramProperty.type) && paramProperty.type.toLowerCase() === 'object') {
          let argType = _.upperFirst(_.camelCase(paramProperty.__type || paramProperty.name))
          if (API.some(a => a.name === argType)) {
            paramProperty.type = argType
            debug(`Auto-correcting type from Object --> ${argType} in Interface: ${_.upperFirst(param.tName)} --- This should be fixed in the docs`.red)
          } else {
            nestedInterfacesToDeclare[argType] = paramProperty
            nestedInterfacesToDeclare[argType].name = paramProperty.name
            nestedInterfacesToDeclare[argType].tName = argType
            paramProperty.type = argType
          }
        }

        if (Array.isArray(paramProperty.type)) {
          paramProperty.type = paramProperty.type.map((paramPropertyType) => {
            if (paramPropertyType.typeName === 'Function' && paramPropertyType.parameters) {
              return Object.assign({}, paramPropertyType, { typeName: utils.genMethodString(module.exports, param, paramProperty, paramProperty.parameters, paramProperty.returns, true) })
            }
            return paramPropertyType
          })
        }
        if (!Array.isArray(paramProperty.type) && paramProperty.type.toLowerCase() === 'function') {
          paramAPI.push(`${paramProperty.name}${utils.isOptional(paramProperty) ? '?' : ''}: ${utils.genMethodString(module.exports, param, paramProperty, paramProperty.parameters, paramProperty.returns, true)};`)
        } else {
          paramAPI.push(`${paramProperty.name}${utils.isOptional(paramProperty) ? '?' : ''}: ${utils.typify(paramProperty.__type || paramProperty)};`)
        }
      })
      paramAPI.push('}')
      // console.log(paramAPI)
      addToOutput(paramAPI.map((l, index) => (index === 0 || index === paramAPI.length - 1) ? l : `  ${l}`))
      delete paramInterfacesToDeclare[paramKey]
    })

    Object.assign(paramInterfacesToDeclare, nestedInterfacesToDeclare)
  }
}

module.exports = {
  createParamInterface,
  flushParamInterfaces
}
