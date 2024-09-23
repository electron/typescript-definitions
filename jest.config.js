import path from 'node:path';
import { createDefaultEsmPreset } from 'ts-jest';

/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testPathIgnorePatterns: ['node_modules', path.resolve(import.meta.dirname, 'dist')],
  ...createDefaultEsmPreset({
    tsconfig: 'tsconfig.json',
  })
};
