'use strict'

const _ = require('lodash')

module.exports = (API, addThing) => {
  // Generate Main / Renderer process interfaces
  const CommonInterface = ['interface CommonInterface {']
  const MainInterface = ['interface MainInterface extends CommonInterface {']
  const RendererInterface = ['interface RendererInterface extends CommonInterface {']
  const ElectronMainAndRendererInterface = ['interface AllElectron {']
  const EMRI = {}

  API.forEach((module, index) => {
    let TargetInterface
    const isClass = module.type === 'Class' || API.some((tModule, tIndex) => index !== tIndex && tModule.name.toLowerCase() === module.name.toLowerCase())
    const moduleString = `  ${module.name}: ${isClass ? 'typeof ' : ''}Electron.${_.upperFirst(module.name)}`
    if (module.process.main && module.process.renderer) {
      TargetInterface = CommonInterface
    } else if (module.process.main) {
      TargetInterface = MainInterface
    } else if (module.process.renderer) {
      TargetInterface = RendererInterface
    }
    if (module.type === 'Structure') {
      TargetInterface = null
    }
    if (TargetInterface) {
      if (!EMRI[module.name.toLowerCase()]) ElectronMainAndRendererInterface.push(moduleString)
      EMRI[module.name.toLowerCase()] = true
      TargetInterface.push(moduleString)
    }
  })

  CommonInterface.push('}')
  MainInterface.push('}')
  RendererInterface.push('}')
  ElectronMainAndRendererInterface.push('}')

  addThing([''])
  addThing(CommonInterface, ';')
  addThing(MainInterface, ';')
  addThing(RendererInterface, ';')
  addThing(ElectronMainAndRendererInterface, ';')
}
