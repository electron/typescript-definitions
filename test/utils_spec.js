const expect = require('chai').expect
const utils = require('../lib/utils')

describe('utils', () => {
  describe('extendArray', () => {
    it('should return an array with all elements added correctly', () => {
      expect(utils.extendArray(['foo'], ['bar'])).to.deep.equal(['foo', 'bar'])
    })

    it('should return an array with all elements added in the correct oreder', () => {
      expect(utils.extendArray([1, 2, 3, 4], [2, 3, 4, 5])).to.deep.equal([1, 2, 3, 4, 2, 3, 4, 5])
    })

    it('should mutate the original array', () => {
      const primary = [1, 5, 9]
      const secondary = [2, 6, 10]
      utils.extendArray(primary, secondary)
      expect(primary).to.deep.equal([1, 5, 9, 2, 6, 10])
    })
  })

  describe('wrapComment', () => {
    it('should return an array', () => {
      expect(utils.wrapComment('Foo Bar')).to.be.a('array')
    })

    it('should be a correctly formatted JS multi-line comment', () => {
      const wrapped = utils.wrapComment('Foo bar')
      expect(wrapped[0]).to.be.equal('/**')
      expect(wrapped[wrapped.length - 1]).to.be.equal(' */')
    })

    it('should wrap each line to be a max of 80 chars', () => {
      const reallyLongString = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec pulvinar nibh eu orci fringilla interdum. In mi arcu, accumsan nec justo eget, pharetra egestas mauris. Quisque nisl tellus, sagittis lobortis commodo nec, tincidunt a arcu. Donec congue lacus a lacus euismod, in hendrerit nunc faucibus. Praesent ac libero eros. Nunc lorem turpis, elementum vel pellentesque vitae, aliquet et erat. In tempus, nulla vitae cursus congue, massa dui pretium eros, eget ornare ipsum diam a velit. Aliquam ac iaculis dui. Phasellus mollis augue volutpat turpis posuere scelerisque. Donec a rhoncus nisl, eu viverra massa. Suspendisse rutrum fermentum diam, posuere tempus turpis accumsan in. Pellentesque commodo in leo vitae aliquet. Vestibulum id justo ac odio mollis fringilla ac a odio. Quisque rhoncus pretium risus, tristique convallis urna.'
      const wrapped = utils.wrapComment(reallyLongString)
      wrapped.forEach(line => {
        // Subtract 3 due to commend prefix " * "
        expect(line.length - 3).to.be.lte(80)
      })
    })

    it('should not split words unless it needs to', () => {
      const wrapped = utils.wrapComment('Thisisalongword Thisisalongword Thisisalongword Thisisalongword Thisisalongword Thisisalongword Thisisalongword Thisisalongword')
      wrapped.forEach((line, index) => {
        if (index === 0 || index === wrapped.length - 1) return
        expect(line.endsWith('Thisisalongword')).to.eq(true)
      })
    })
  })

  describe('typify', () => {
    it('should lower case known types', () => {
      expect(utils.typify('String')).to.equal('string')
      expect(utils.typify('Number')).to.equal('number')
    })

    it('should convert specific number types to typescript types', () => {
      expect(utils.typify('Integer')).to.equal('number')
      expect(utils.typify('Float')).to.equal('number')
      expect(utils.typify('Double')).to.equal('number')
      expect(utils.typify('Number')).to.equal('number')
    })

    it('should lower case known array types', () => {
      expect(utils.typify('String[]')).to.equal('string[]')
      expect(utils.typify('Number[]')).to.equal('number[]')
    })

    it('should map an array of types through typify as well', () => {
      expect(utils.typify(['String', 'Float', 'Boolean'])).to.deep.equal('string | number | boolean')
    })

    it('should map an array of types through typify as well and remove duplicates', () => {
      expect(utils.typify(['String', 'Float', 'Double'])).to.deep.equal('string | number')
    })

    it('should map node objects to the correct type', () => {
      expect(utils.typify('buffer')).to.equal('Buffer')
    })
  })

  describe('paramify', () => {
    it('should pass through most param names', () => {
      expect(utils.paramify('foo')).to.equal('foo')
    })

    it('should clean reserved words', () => {
      expect(utils.paramify('switch')).to.equal('the_switch')
    })
  })

  describe('isEmitter', () => {
    it('should return true on most modules', () => {
      expect(utils.isEmitter({ name: 'app' })).to.eq(true)
    })

    it('should return false for specific non-emitter modules', () => {
      expect(utils.isEmitter({ name: 'menuitem' })).to.eq(false)
    })
  })

  describe('isOptional', () => {
    it('should return true if param is not required', () => {
      expect(utils.isOptional({})).to.eq(true)
    })

    it('should return false if param is required', () => {
      expect(utils.isOptional({ required: true })).to.eq(false)
    })

    it('should default to true if param is a non-function', () => {
      expect(utils.isOptional({ type: 'Foo' })).to.eq(true)
    })

    it('should default to false if param is a function', () => {
      expect(utils.isOptional({ type: 'Function' })).to.eq(false)
    })
  })
})
