const _ = require('lodash');
const expect = require('chai').expect;
const { generateModuleDeclaration, getModuleDeclarations } = require('../dist/module-declaration');

const fakeAPI = [
  {
    name: 'FakeModule',
    methods: [
      {
        name: 'example1',
        additionalTags: [],
        parameters: [{ name: 'foo', type: 'string' }],
      },
      {
        name: 'example2',
        additionalTags: ['os_macos'],
        parameters: [{ name: 'foo', type: 'string' }],
      },
    ],
  },
];

describe('module-declaration', () => {
  it('should mark platform-specific methods as optional', () => {
    const API = _.cloneDeep(fakeAPI);
    generateModuleDeclaration(API[0], 0, API);
    expect(getModuleDeclarations()[fakeAPI[0].name].join('\n')).to.contain(
      `
example1(foo?: string): void;
example2?(foo?: string): void;
`.trim(),
    );
  });
});
