const _ = require('lodash')
const { extendArray, isOptional, typify, wrapComment } = require('../utils')

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

// Given a parameter create a new interface and return it's name
// IName is the proposed interface name prefix
// backupIName is a slightly longer IName in case IName is already taken
const createParamInterface = (param, IName = '', backupIName = '') => {
  let argType = polite(IName) + _.upperFirst(_.camelCase(param.name))
  let argName = param.name
  // TODO: Note.  It is still possible for even backupIName to be already used
  // TODO: Note.  We should check if a param interface has already been declared
  //              with the same structure and just return that one
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

const flushParamInterfaces = (API, addThing) => {
  const declared = {}

  while (Object.keys(paramInterfacesToDeclare).length > 0) {
    const nestedInterfacesToDeclare = {}

    Object.keys(paramInterfacesToDeclare).sort((a, b) => paramInterfacesToDeclare[a].tName.localeCompare(paramInterfacesToDeclare[b].tName)).forEach((paramKey) => {
      if (declared[paramKey]) throw new Error('Ruh roh, "' + paramKey + '" is already declared')
      declared[paramKey] = true
      const param = paramInterfacesToDeclare[paramKey]
      const paramAPI = []
      paramAPI.push(`interface ${_.upperFirst(param.tName)} {`)

      param.properties = param.properties || []
      param.properties.forEach((paramProperty) => {
        if (paramProperty.description) {
          extendArray(paramAPI, wrapComment(paramProperty.description))
        }
        if (paramProperty.type.toLowerCase() === 'object') {
          let argType = _.upperFirst(_.camelCase(paramProperty.name))
          if (API.some(a => a.name === argType)) {
            paramProperty.type = argType
            console.warn(`Auto-correcting type from Object --> ${argType} in Interface: ${_.upperFirst(param.tName)} --- This should be fixed in the docs`.red)
          } else {
            nestedInterfacesToDeclare[argType] = paramProperty
            nestedInterfacesToDeclare[argType].name = paramProperty.name
            nestedInterfacesToDeclare[argType].tName = argType
            paramProperty.type = argType
          }
        }
        paramAPI.push(`${paramProperty.name}${isOptional(paramProperty) ? '?' : ''}: ${typify(paramProperty.type)};`)
      })
      paramAPI.push('}')
      // console.log(paramAPI)
      addThing(paramAPI.map((l, index) => (index === 0 || index === paramAPI.length - 1) ? l : `  ${l}`))
      delete paramInterfacesToDeclare[paramKey]
    })

    Object.assign(paramInterfacesToDeclare, nestedInterfacesToDeclare)
  }
}

module.exports = {
  createParamInterface,
  flushParamInterfaces
}
