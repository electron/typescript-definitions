'use strict'

const _ = require('lodash')
require('colors')

const extendArray = (arr1, arr2) => Array.prototype.push.apply(arr1, arr2) && arr1
const wrapComment = (comment) => {
  if (!comment) return []
  comment = comment.replace(/^\(optional\)(?: - )?/gi, '').trim()
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
const typify = (type) => {
  if (Array.isArray(type)) {
    return Array.from(new Set(type.map(t => typify(t)))).join(' | ')
  }
  if (!type) return 'any'
  switch (type.toLowerCase()) {
    case 'double':
    case 'integer':
    case 'float':
      return 'number'
    case 'double[]':
    case 'integer[]':
    case 'float[]':
      return 'number[]'
    case 'array':
      console.warn('Untyped "Array" as return type'.yellow)
      return 'any[]'
    case 'true':
    case 'false':
      console.warn('"true" or "false" provided as return value, inferring "Boolean" type'.info)
      return 'boolean'
    case '[objects]':
      console.warn('[Objects] is not a valid array definition, please conform to the styleguide'.red)
      return 'any[]'
    case 'object':
      console.warn('Unstructured "Object" type specified'.yellow)
      return 'any'
    case 'any':
      return 'any'
    case 'string':
    case 'boolean':
    case 'number':
    case 'string[]':
    case 'boolean[]':
    case 'number[]':
      return type.toLowerCase()
    case 'buffer':
      return 'Buffer'
    case 'buffer[]':
      return 'Buffer[]'
  }
  return type
}
const paramify = (paramName) => {
  switch (paramName.toLowerCase()) {
    case 'switch':
      return 'the_switch'
  }
  return paramName
}
const isEmitter = (module) => {
  switch (module.name.toLowerCase()) {
    case 'menu':
    case 'menuitem':
    case 'nativeimage':
    case 'shell':
      return false
    default:
      return true
  }
}
const isOptional = (param) => {
  if (/optional/gi.test(param.description)) return true
  if (/^\(.+\)/g.test(param.description) && !/required/gi.test(param.description)) {
    return true
  }
  return false
}

const genMethodString = (paramInterfaces, module, moduleMethod, parameters, returns, includeType) => {
  if (typeof includeType === 'undefined') includeType = true
  return `${includeType ? '(' : ''}${(parameters || []).map((param) => {
    let paramType = param.type
    if (param.type === 'Object' && param.properties && param.properties.length) {
      // Check if we have the same structure for a different name
      if (param.name === 'options') {
        if (['show', 'hide', 'open', 'close', 'start', 'stop'].includes((moduleMethod._name || moduleMethod.name).toLowerCase())) {
          paramType = paramInterfaces.createParamInterface(param, _.upperFirst(module.name) + _.upperFirst(moduleMethod._name || moduleMethod.name))
        } else {
          paramType = paramInterfaces.createParamInterface(param, _.upperFirst(moduleMethod._name || moduleMethod.name))
        }
      } else {
        paramType = paramInterfaces.createParamInterface(param, _.upperFirst(moduleMethod._name) || '', _.upperFirst(moduleMethod.name))
      }
    }
    if (param.type === 'Function' && param.parameters) {
      paramType = genMethodString(paramInterfaces, module, moduleMethod, param.parameters, param.returns)
    }
    return `${paramify(param.name)}${isOptional(param) ? '?' : ''}: ${
      param.possibleValues && param.possibleValues.length
      ? param.possibleValues.map(v => `'${v.value}'`).join(' | ')
      : typify(paramType)
    }`
  }).join(', ')}${includeType ? `) => ${returns ? typify(returns.type) : 'void'}` : ''}`
}

module.exports = {
  extendArray,
  isEmitter,
  isOptional,
  paramify,
  typify,
  wrapComment,
  genMethodString
}
