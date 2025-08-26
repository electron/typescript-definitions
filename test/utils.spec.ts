import { DocumentationTag } from '@electron/docs-parser';
import { describe, expect, it } from 'vitest';

import * as utils from '../src/utils.js';

describe('utils', () => {
  describe('extendArray', () => {
    it('should return an array with all elements added correctly', () => {
      expect(utils.extendArray(['foo'], ['bar'])).toEqual(['foo', 'bar']);
    });

    it('should return an array with all elements added in the correct oreder', () => {
      expect(utils.extendArray([1, 2, 3, 4], [2, 3, 4, 5])).toEqual([1, 2, 3, 4, 2, 3, 4, 5]);
    });

    it('should mutate the original array', () => {
      const primary = [1, 5, 9];
      const secondary = [2, 6, 10];
      utils.extendArray(primary, secondary);
      expect(primary).toEqual([1, 5, 9, 2, 6, 10]);
    });
  });

  describe('wrapComment', () => {
    it('should return an array', () => {
      expect(utils.wrapComment('Foo Bar')).toHaveLength(3);
    });

    it('should be a correctly formatted JS multi-line comment', () => {
      const wrapped = utils.wrapComment('Foo bar');
      expect(wrapped[0]).toEqual('/**');
      expect(wrapped[wrapped.length - 1]).toEqual(' */');
    });

    it('should wrap each line to be a max of 80 chars', () => {
      const reallyLongString =
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec pulvinar nibh eu orci fringilla interdum. In mi arcu, accumsan nec justo eget, pharetra egestas mauris. Quisque nisl tellus, sagittis lobortis commodo nec, tincidunt a arcu. Donec congue lacus a lacus euismod, in hendrerit nunc faucibus. Praesent ac libero eros. Nunc lorem turpis, elementum vel pellentesque vitae, aliquet et erat. In tempus, nulla vitae cursus congue, massa dui pretium eros, eget ornare ipsum diam a velit. Aliquam ac iaculis dui. Phasellus mollis augue volutpat turpis posuere scelerisque. Donec a rhoncus nisl, eu viverra massa. Suspendisse rutrum fermentum diam, posuere tempus turpis accumsan in. Pellentesque commodo in leo vitae aliquet. Vestibulum id justo ac odio mollis fringilla ac a odio. Quisque rhoncus pretium risus, tristique convallis urna.';
      const wrapped = utils.wrapComment(reallyLongString);
      wrapped.forEach((line) => {
        // Subtract 3 due to commend prefix " * "
        expect(line.length - 3).toBeLessThanOrEqual(80);
      });
    });

    it('should not split words unless it needs to', () => {
      const wrapped = utils.wrapComment(
        'Thisisalongword Thisisalongword Thisisalongword Thisisalongword Thisisalongword Thisisalongword Thisisalongword Thisisalongword',
      );
      wrapped.forEach((line, index) => {
        if (index === 0 || index === wrapped.length - 1) return;
        expect(line.endsWith('Thisisalongword')).toEqual(true);
      });
    });

    it('should handle long urls and not create needless empty lines', () => {
      const wrapped = utils.wrapComment(
        'Unregisters the app from notifications received from APNS. See: https://developer.apple.com/documentation/appkit/nsapplication/1428747-unregisterforremotenotifications?language=objc',
      );
      expect(wrapped.length).toEqual(4);
    });

    it('should create a tag-only comment', () => {
      const wrapped = utils.wrapComment('', [DocumentationTag.STABILITY_DEPRECATED]);
      expect(wrapped.length).toEqual(3);
      expect(wrapped[0]).toEqual('/**');
      expect(wrapped[1].endsWith('@deprecated')).toEqual(true);
      expect(wrapped[wrapped.length - 1]).toEqual(' */');
    });
  });

  describe('typify', () => {
    it('should lower case known types', () => {
      expect(utils.typify('String')).toEqual('string');
      expect(utils.typify('Number')).toEqual('number');
    });

    it('should convert specific number types to typescript types', () => {
      expect(utils.typify('Integer')).toEqual('number');
      expect(utils.typify('Float')).toEqual('number');
      expect(utils.typify('Double')).toEqual('number');
      expect(utils.typify('Number')).toEqual('number');
    });

    it('should correctly convert a void function', () => {
      expect(utils.typify('VoidFunction')).toEqual('(() => void)');
    });

    it('should lower case known array types', () => {
      expect(utils.typify('String[]')).toEqual('string[]');
      expect(utils.typify('Number[]')).toEqual('number[]');
    });

    it('should map an array of types through typify as well', () => {
      expect(utils.typify(['String', 'Float', 'Boolean'])).toEqual(
        '(string) | (number) | (boolean)',
      );
    });

    it('should map an array of types through typify as well and remove duplicates', () => {
      expect(utils.typify(['String', 'Float', 'Double'])).toEqual('(string) | (number)');
    });

    it('should map node objects to the correct type', () => {
      expect(utils.typify('buffer')).toEqual('Buffer');
    });

    it('should convert a promise with multiple inner types', () => {
      expect(
        utils.typify({
          collection: false,
          innerTypes: [
            {
              collection: false,
              type: [
                {
                  collection: false,
                  type: 'number',
                },
                {
                  collection: false,
                  type: 'null',
                },
              ],
            },
          ],
          type: 'Promise',
        }),
      ).toEqual('Promise<(number) | (null)>');
    });

    it('should convert custom types with inner types', () => {
      expect(
        utils.typify({
          collection: false,
          innerTypes: [
            {
              collection: false,
              type: 'T',
            },
          ],
          type: 'Foo',
        }),
      ).toEqual('Foo<T>');

      expect(
        utils.typify({
          collection: false,
          innerTypes: [
            {
              collection: false,
              type: 'A',
            },
            {
              collection: false,
              type: 'B',
            },
          ],
          type: 'Foo',
        }),
      ).toEqual('Foo<A, B>');
    });
  });

  describe('paramify', () => {
    it('should pass through most param names', () => {
      expect(utils.paramify('foo')).toEqual('foo');
    });

    it('should clean reserved words', () => {
      expect(utils.paramify('switch')).toEqual('the_switch');
    });
  });

  describe('isEmitter', () => {
    it('should return true on most modules', () => {
      expect(utils.isEmitter({ name: 'app', type: 'Module', events: [1] } as any)).toEqual(true);
    });

    it('should return false for specific non-emitter modules', () => {
      expect(
        utils.isEmitter({
          name: 'menuitem',
          type: 'Class',
          instanceEvents: [],
          instanceMethods: [],
        } as any),
      ).toEqual(false);
    });
  });

  describe('isOptional', () => {
    it('should return true if param is not required', () => {
      expect(utils.isOptional({} as any)).toEqual(true);
    });

    it('should return false if param is required', () => {
      expect(utils.isOptional({ required: true } as any)).toEqual(false);
    });

    it('should default to true if param is a non-function', () => {
      expect(utils.isOptional({ type: 'Foo' } as any)).toEqual(true);
    });

    it('should default to false if param is a function', () => {
      expect(utils.isOptional({ type: 'Function' } as any)).toEqual(false);
    });
  });
});
