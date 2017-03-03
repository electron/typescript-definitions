const _ = require('lodash')
const expect = require('chai').expect
const remapOptionals = require('../lib/remap-optionals')

const fakeAPI = [{
  name: 'FakeModule',
  methods: [
    {
      name: 'example',
      parameters: [
        {
          name: 'foo',
          description: 'optional'
        },
        {
          name: 'bar',
          required: true
        }
      ]
    },
    {
      name: 'example2',
      parameters: [
        {
          name: 'foo',
          required: true
        },
        {
          name: 'bar',
          description: 'optional'
        }
      ]
    }
  ]
}]

const middleAPI = [{
  name: 'MiddleModule',
  methods: [
    {
      name: 'example',
      parameters: [
        {
          name: 'foo',
          required: true
        },
        {
          name: 'bar',
          required: false
        },
        {
          name: 'fee',
          required: true
        }
      ]
    }
  ]
}]

describe('remap-optionals', () => {
  it('should duplicate a method with a preceeding optional parameter', () => {
    const API = _.cloneDeep(fakeAPI)
    expect(API[0].methods.length).to.equal(2)
    remapOptionals(API)
    expect(API[0].methods.length).to.equal(3)
  })

  it('should duplicate methods and remove preceeding optional parameters', () => {
    const API = _.cloneDeep(fakeAPI)
    expect(API[0].methods[0].parameters.length).to.equal(2)
    remapOptionals(API)
    expect(API[0].methods[2].parameters.length).to.equal(1)
  })

  it('should make the original method legal by making param non-optional', () => {
    const API = _.cloneDeep(fakeAPI)
    expect(API[0].methods[0].parameters[0].description).to.contain('optional')
    remapOptionals(API)
    expect(API[0].methods[0].parameters[0].description).to.not.contain('optional')
  })

  it('should not affect legal parameter orders', () => {
    const API = _.cloneDeep(fakeAPI)
    const methodBefore = _.cloneDeep(API[0].methods[1])
    remapOptionals(API)
    expect(API[0].methods[1]).to.deep.equal(methodBefore)
  })

  it('should remap optional middle params', () => {
    const API = _.cloneDeep(middleAPI)
    expect(API[0].methods.length).to.equal(1)
    expect(API[0].methods[0].parameters.length).to.equal(3)
    remapOptionals(API)
    expect(API[0].methods.length).to.equal(2)
    expect(API[0].methods[1].parameters.length).to.equal(2)

    expect(API[0].methods[0].parameters[0].required).to.equal(true, 'should make prefixed optionals required')
    expect(API[0].methods[0].parameters[1].required).to.equal(true, 'should make prefixed optionals required')
    expect(API[0].methods[0].parameters[2].required).to.equal(true, 'should make prefixed optionals required')

    expect(API[0].methods[1].parameters[0].required).to.equal(true, 'should make prefixed optionals required')
    expect(API[0].methods[1].parameters[1].required).to.equal(true, 'should make prefixed optionals required')
  })
})
