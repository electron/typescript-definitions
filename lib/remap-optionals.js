'use strict'

const _ = require('lodash')
const utils = require('./utils')
const debug = require('debug')('remap-optionals')

module.exports = (API) => {
  API.forEach((module) => {
    // Remap optionals to actually be multiple methods when appropriate
    const remap = (attr) => {
      const moreMethods = []
      const attrs = module[attr] || []
      attrs.forEach(method => {
        if (!method.parameters) return
        if (method.__handled) return
        let optionalFound = false
        _.concat([], method.parameters).forEach((param, index) => {
          if (optionalFound && !utils.isOptional(param)) {
            debug(`Duplicating method due to prefixed optional: ${method.name} Slicing at: ${index}`.cyan)
            moreMethods.push(Object.assign({}, _.cloneDeep(method), {
              parameters: [].concat(_.cloneDeep(method.parameters)).filter((tParam, pIndex) => {
                if (pIndex >= index) return true
                return !utils.isOptional(tParam)
              })
            }))
            for (let i = 0; i < index; i++) {
              if (method.parameters[i].description) {
                method.parameters[i].description = method.parameters[i].description.replace(/optional/gi, '')
              }
              method.parameters[i].required = true
            }
            method.__handled = true
          }
          optionalFound = optionalFound || utils.isOptional(param)
        })
      })
      moreMethods.forEach((newMethod) => module[attr].push(newMethod))
    }

    remap('methods')
    remap('instanceMethods')
    remap('staticMethods')
  })
}
