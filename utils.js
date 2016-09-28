const extendArray = (arr1, arr2) => Array.prototype.push.apply(arr1, arr2)
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
const typify = (type) => {
  switch (type.toLowerCase()) {
    case 'double':
    case 'integer':
    case 'float':
      return 'Number'
    case 'double[]':
    case 'integer[]':
    case 'float[]':
      return 'Number[]'
    case 'array':
      console.warn('Untyped "Array" as return type')
      return 'any[]'
    case 'true':
    case 'false':
      console.warn('"true" or "false" provided as return value, inferring "Boolean" type')
      return 'Boolean'
    case '[objects]':
      console.warn('[Objects] is not a valid array definition, please conform to the styleguide')
      return 'any[]'
    case 'object':
      console.warn('Unstructured "Object" type specified')
      return 'any'
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
const isOptional = (param) => {
  if (/optional/gi.test(param.description)) return true
  if (/^\(.+\)/g.test(param.description) && !/required/gi.test(param.description)) {
    return true
  }
  return false
}

module.exports = {
  extendArray,
  isOptional,
  paramify,
  typify,
  wrapComment
}
