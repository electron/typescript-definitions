import _ from 'lodash';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as utils from './utils';
import { getModuleDeclarations, generateModuleDeclaration } from './module-declaration';
import { remapOptionals } from './remap-optionals';
import { generateMasterInterfaces } from './master-interfaces';
import { ParsedDocumentationResult } from '@electron/docs-parser';
import { DynamicParamInterfaces } from './dynamic-param-interfaces';

// takes the predefined header and footer and wraps them around the generated files
const wrapWithHeaderAndFooter = (outputLines: string[], electronVersion: string) => {
  const newOutputLines: string[] = [];
  utils.extendArray(
    newOutputLines,
    fs
      .readFileSync(path.resolve(__dirname, '../base/base_header.ts'), 'utf8')
      .replace('<<VERSION>>', electronVersion)
      .split(/\r?\n/),
  );

  newOutputLines.push('declare namespace Electron {');
  utils.extendArray(
    newOutputLines,
    fs
      .readFileSync(path.resolve(__dirname, '../base/base_inner.ts'), 'utf8')
      .replace('<<VERSION>>', electronVersion)
      .split(/\r?\n/),
  );

  outputLines.slice(1).forEach(l => newOutputLines.push(`${_.trimEnd(`  ${l}`)}`));
  utils.extendArray(newOutputLines, ['}', '']);

  utils.extendArray(
    newOutputLines,
    fs
      .readFileSync(path.resolve(__dirname, '../base/base_footer.ts'), 'utf8')
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
    '    electron: string;',
    '    chrome: string;',
    '  }',
  ]);

  utils.extendArray(outputLines, ['}']);

  return outputLines.join('\n');
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
  generateMasterInterfaces(API, addToOutput);

  // generate module declaration for every class, module, structure, element, etc
  API.sort((m1, m2) => m1.name.localeCompare(m2.name)).forEach((module, index) => {
    generateModuleDeclaration(module, index, API);
  });

  // fetch everything that's been made and pop it into the actual API
  Object.keys(getModuleDeclarations()).forEach(moduleKey => {
    if (moduleKey === 'Process') return;
    const moduleAPI = getModuleDeclarations()[moduleKey];
    moduleAPI.push('}');
    addToOutput(
      moduleAPI.map((l, index) => (index === 0 || index === moduleAPI.length - 1 ? l : `  ${l}`)),
    );
  });

  DynamicParamInterfaces.flushParamInterfaces(API, addToOutput);

  const electronOutput = wrapWithHeaderAndFooter(outputLines, API[0].version);

  return appendNodeJSOverride(electronOutput);
}
