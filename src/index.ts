import fs from 'node:fs';
import path from 'node:path';

import { ParsedDocumentationResult } from '@electron/docs-parser';
import _ from 'lodash';

import * as utils from './utils.js';
import { getModuleDeclarations, generateModuleDeclaration } from './module-declaration.js';
import { remapOptionals } from './remap-optionals.js';
import { generatePrimaryInterfaces } from './primary-interfaces.js';
import { DynamicParamInterfaces } from './dynamic-param-interfaces.js';

// takes the predefined header and footer and wraps them around the generated files
const wrapWithHeaderAndFooter = (outputLines: string[], electronVersion: string) => {
  const newOutputLines: string[] = [];
  utils.extendArray(
    newOutputLines,
    fs
      .readFileSync(path.resolve(import.meta.dirname, '../base/base_header.ts'), 'utf8')
      .replace('<<VERSION>>', electronVersion)
      .split(/\r?\n/),
  );

  newOutputLines.push('declare namespace Electron {');
  utils.extendArray(
    newOutputLines,
    fs
      .readFileSync(path.resolve(import.meta.dirname, '../base/base_inner.ts'), 'utf8')
      .replace('<<VERSION>>', electronVersion)
      .split(/\r?\n/),
  );

  outputLines.slice(0).forEach((l) => newOutputLines.push(`${_.trimEnd(`  ${l}`)}`));
  utils.extendArray(newOutputLines, ['}', '']);

  utils.extendArray(
    newOutputLines,
    fs
      .readFileSync(path.resolve(import.meta.dirname, '../base/base_footer.ts'), 'utf8')
      .replace('<<VERSION>>', electronVersion)
      .split(/\r?\n/),
  );
  return newOutputLines;
};

const appendNodeJSOverride = (outputLines: string[]) => {
  utils.extendArray(outputLines, ['', 'declare namespace NodeJS {']);

  const processAPI = getModuleDeclarations().Process;
  processAPI.push('}');
  utils.extendArray(
    outputLines,
    processAPI.map((l, index) =>
      l.length ? (index === 0 || index === processAPI.length - 1 ? `  ${l}` : `    ${l}`) : '',
    ),
  );
  utils.extendArray(outputLines, [
    '  interface ProcessVersions {',
    '    readonly electron: string;',
    '    readonly chrome: string;',
    '  }',
  ]);

  utils.extendArray(outputLines, ['}']);

  return outputLines.join('\n') + '\n';
};

interface GenerateOptions {
  electronApi: ParsedDocumentationResult;
}

export async function generateDefinitions({ electronApi: API }: GenerateOptions): Promise<string> {
  const outputLines: string[] = [];

  // adds lines to output with given indentation level
  const addToOutput = (lines: string[], indentation?: string) => {
    indentation = indentation || '';
    utils.extendArray(
      outputLines,
      lines
        .map((l, i) => (i === 0 || i >= lines.length - 1 ? l : `${l}${indentation}`))
        .concat(['\n']),
    );
  };

  remapOptionals(API);

  // generate module declaration for every class, module, structure, element, etc
  const declaredStructs: string[] = [];
  API.sort((m1, m2) => {
    // Ensure constructor options are declared first so as to ensure that
    // setters and getters for constructor options have de-duped types
    if (m1.name.endsWith('ConstructorOptions') && !m2.name.endsWith('ConstructorOptions')) {
      return -1;
    }
    if (!m1.name.endsWith('ConstructorOptions') && m2.name.endsWith('ConstructorOptions')) {
      return 1;
    }
    return m1.name.localeCompare(m2.name);
  }).forEach((module, index) => {
    if (module.type === 'Structure') {
      declaredStructs.push(module.name);
    }
    generateModuleDeclaration(module, index, API);
  });

  // fetch everything that's been made and pop it into the actual API
  Object.keys(getModuleDeclarations())
    .sort((m1, m2) => m1.localeCompare(m2))
    .forEach((moduleKey) => {
      if (moduleKey === 'Process') return;
      const moduleAPI = getModuleDeclarations()[moduleKey];
      moduleAPI.push('}');
      addToOutput(
        moduleAPI.map((l, index) => (index === 0 || index === moduleAPI.length - 1 ? l : `  ${l}`)),
      );
    });

  const keys = DynamicParamInterfaces.flushParamInterfaces(API, addToOutput);
  generatePrimaryInterfaces(API, [...keys, ...declaredStructs], addToOutput);

  const electronOutput = wrapWithHeaderAndFooter(outputLines, API[0].version);

  return appendNodeJSOverride(electronOutput);
}
