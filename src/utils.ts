import chalk from 'chalk';
import {
  TypeInformation,
  DetailedStringType,
  ModuleDocumentationContainer,
  MethodDocumentationBlock,
  DetailedObjectType,
  DocumentationBlock,
  DetailedFunctionType,
} from '@electron/docs-parser';
import _ from 'lodash';
import d from 'debug';
import { DynamicParamInterfaces } from './dynamic-param-interfaces';
const debug = d('utils');

let paramInterfaces: typeof DynamicParamInterfaces;
const lazyParamInterfaces = () => {
  if (!paramInterfaces) {
    paramInterfaces = require('./dynamic-param-interfaces').DynamicParamInterfaces;
  }
  return paramInterfaces;
};

export const extendArray = <T>(arr1: T[], arr2: T[]): T[] => {
  arr1.push(...arr2);
  return arr1;
};

export const wrapComment = (comment: string): string[] => {
  if (!comment) return [];
  comment = comment.replace(/^\(optional\)(?: - )?/gi, '').trim();
  if (!comment) return [];
  const result = ['/**'];
  while (comment.trim().length > 0) {
    let index = 0;
    for (let i = 0; i <= 80; i++) {
      if (comment[i] === ' ') index = i;
      if (comment[i] === '\n') {
        index = i;
        break;
      }
    }
    if (comment.length <= 80) {
      index = 80;
    }
    result.push(` * ${comment.substring(0, index)}`);
    comment = comment.substring(index + 1);
  }
  return result.concat(' */');
};

const prefixTypeForSafety = (type: string) => {
  if (type !== 'Object' && typeof type === 'string' && !isPrimitive(type) && !isBuiltIn(type)) {
    return `Electron.${type}`;
  }
  return type;
};

export const typify = (
  type: TypeInformation | TypeInformation[],
  maybeInnerReturnTypeName?: string,
): string => {
  // Capture some weird edge cases
  const originalType = type;
  if (!Array.isArray(type) && type.type && typeof type.type === 'object') {
    type = type.type;
  }

  if (Array.isArray(type)) {
    const arrayType = Array.from(new Set(type.map(t => `(${typify(t)})`))).join(' | ');
    if (!Array.isArray(originalType) && originalType.collection) {
      return `Array<${arrayType}>`;
    }
    return arrayType;
  }

  if (!type) return 'any';

  let innerTypes: TypeInformation[] | undefined;
  let typeAsString: string | TypeInformation | TypeInformation[] = type;

  if (typeof type === 'object') {
    let newType = type.type || 'any';

    if (typeof newType === 'string' && newType.toLowerCase() === 'string') {
      const stringType = type as DetailedStringType;
      if (stringType.possibleValues) {
        const stringEnum = stringType.possibleValues!.map(value => `'${value.value}'`).join(' | ');
        if (type.collection) {
          // Array<foo | bar> syntax instead of (foo | bar)[]
          newType = `Array<${stringEnum}>`;
          type.collection = false;
        } else {
          newType = `(${stringEnum})`;
        }
      }
    }

    if (type.innerTypes) {
      innerTypes = type.innerTypes;
      if (type.innerTypes) {
        // Handle one of the innerType being an Object type
        innerTypes = type.innerTypes.map(inner =>
          inner.type === 'Object'
            ? {
                ...inner,
                type: lazyParamInterfaces().createParamInterface(
                  inner as any,
                  maybeInnerReturnTypeName,
                ),
              }
            : inner,
        );
      }
    }

    typeAsString = newType;
  }

  if (type.collection) typeAsString += '[]';

  if (typeof typeAsString !== 'string') {
    throw new Error('typeAsString is not a string, something has gone terribly wrong');
  }

  switch (typeAsString.toLowerCase()) {
    case 'double':
    case 'integer':
    case 'float':
      return 'number';
    case 'double[]':
    case 'integer[]':
    case 'float[]':
      return 'number[]';
    case 'array': {
      if (innerTypes) return `Array<${typify(innerTypes[0])}>`;
      debug(chalk.yellow('Untyped "Array" as return type'));
      return 'any[]';
    }
    case 'true':
    case 'false':
      debug(chalk.cyan('"true" or "false" provided as return value, inferring "Boolean" type'));
      return 'boolean';
    case '[objects]':
      debug(
        chalk.red('[Objects] is not a valid array definition, please conform to the styleguide'),
      );
      return 'any[]';
    case 'object':
      debug(chalk.yellow('Unstructured "Object" type specified'));
      return 'any';
    case 'any':
      return 'any';
    case 'string':
    case 'boolean':
    case 'number':
    case 'string[]':
    case 'boolean[]':
    case 'number[]':
      return typeAsString.toLowerCase();
    case 'buffer':
      return 'Buffer';
    case 'buffer[]':
      return 'Buffer[]';
    case 'voidfunction':
      return '(() => void)';
    case 'promise':
      if (innerTypes) {
        return `Promise<${prefixTypeForSafety(typify(innerTypes[0]))}>`;
      }
      debug(chalk.red('Promise with missing inner type, defaulting to any'));
      return 'Promise<any>';
    case 'record':
      if (innerTypes && innerTypes.length === 2) {
        return `Record<${typify(innerTypes[0])}, ${typify(innerTypes[1])}>`;
      }
      debug(chalk.red('Record with missing inner types, default to any'));
      return 'Record<any, any>';
    case 'partial':
      if (!innerTypes || innerTypes.length !== 1) {
        throw new Error('Partial generic type must have exactly one inner type.  i.e. Partial<T>');
      }
      return `Partial<${typify(innerTypes[0])}>`;
    case 'url':
      return 'string';
    case 'touchbaritem':
      return '(TouchBarButton | TouchBarColorPicker | TouchBarGroup | TouchBarLabel | TouchBarPopover | TouchBarScrubber | TouchBarSegmentedControl | TouchBarSlider | TouchBarSpacer | null)';
    case 'readablestream':
      // See StreamProtocolResponse.data which accepts a Node.js readable stream.
      // The ReadableStream type unfortunately conflicts with the ReadableStream interface
      // defined in the Streams standard (https://streams.spec.whatwg.org/#rs-class) so
      // we'll have to qualify it with the Node.js namespace.
      return 'NodeJS.ReadableStream';
  }
  return typeAsString;
};
export const paramify = (paramName: string) => {
  switch (paramName.toLowerCase()) {
    case 'switch':
      return 'the_switch';
  }
  return paramName;
};
// TODO: Infer through electron-docs-linter/parser
export const isEmitter = (module: Pick<ModuleDocumentationContainer, 'name'>) => {
  const nonEventEmitters = [
    'menu',
    'menuitem',
    'nativeimage',
    'shell',
    'browserview',
    'webrequest',
    'crashreporter',
    'dock',
    'commandline',
    'browserwindowproxy',
    'clipboard',
    'contenttracing',
    'desktopcapturer',
    'dialog',
    'globalshortcut',
    'powersaveblocker',
    'touchbar',
    'touchbarbutton',
    'net',
    'netlog',
    'protocol'
  ];
  return !(nonEventEmitters.includes(module.name.toLowerCase()))
};
export const isPrimitive = (type: string) => {
  const primitives = ['boolean', 'number', 'any', 'string', 'void', 'unknown'];
  return primitives.indexOf(type.toLowerCase().replace(/\[\]/g, '')) !== -1;
};
export const isBuiltIn = (type: string) => {
  const builtIns = ['promise', 'buffer'];
  return builtIns.indexOf(type.toLowerCase().replace(/\[\]/g, '')) !== -1;
};
export const isOptional = (param: { required?: boolean; name: string; type: any }) => {
  // Did we pass a "required"?
  if (typeof param.required !== 'undefined') {
    return !param.required;
  }

  // FIXME: Review this after migration to docs-parser
  // Assume that methods are never optional because electron-docs-linter
  // doesn't currently mark them as required.
  debug(`Could not determine optionality for ${param.name}`);
  return param.type !== 'Function';
};

export const genMethodString = (
  paramInterfaces: typeof DynamicParamInterfaces,
  module: { name: string },
  moduleMethod: MethodDocumentationBlock,
  includeType = true,
  paramTypePrefix = '',
): string => {
  return `${includeType ? '(' : ''}${(moduleMethod.parameters || [])
    .map(param => {
      let paramType: string | null = param as any;

      const objectParam = param as DetailedObjectType &
        TypeInformation &
        DocumentationBlock & { required: boolean };
      if (param.type === 'Object' && objectParam.properties && objectParam.properties.length) {
        // Check if we have the same structure for a different name
        if (param.name === 'options') {
          if (
            ['show', 'hide', 'open', 'close', 'start', 'stop', 'constructor'].includes(
              moduleMethod.name.toLowerCase(),
            )
          ) {
            paramType = paramInterfaces.createParamInterface(
              objectParam,
              _.upperFirst(module.name) + _.upperFirst(moduleMethod.name),
            );
          } else {
            paramType = paramInterfaces.createParamInterface(
              objectParam,
              _.upperFirst(moduleMethod.name),
            );
          }
        } else {
          paramType = paramInterfaces.createParamInterface(
            objectParam,
            '',
            _.upperFirst(moduleMethod.name),
          );
        }
      }

      if (Array.isArray(param.type)) {
        param.type = param.type.map(paramType => {
          const functionParam = paramType as DetailedFunctionType;
          if (paramType.type === 'Function' && functionParam.parameters) {
            return Object.assign({}, paramType, {
              type: genMethodString(
                paramInterfaces,
                module,
                {
                  name: _.upperFirst(moduleMethod.name) + _.upperFirst(param.name),
                  ...functionParam,
                } as any /* FIXME: */,
              ),
            });
          }
          return paramType;
        });
      }
      const functionParam = param as DetailedFunctionType;
      if (param.type === 'Function' && functionParam.parameters) {
        paramType = genMethodString(paramInterfaces, module, functionParam as any /* FIXME: */);
      }

      const name = paramify(param.name);
      const optional = isOptional(param) ? '?' : '';

      // Figure out this parameter's type
      let type;
      const stringParam = param as DetailedStringType;
      if (stringParam.possibleValues && stringParam.possibleValues.length) {
        type = stringParam.possibleValues.map(v => `'${v.value}'`).join(' | ');
      } else {
        type = `${typify(paramType as any)}${
          paramify(param.name).startsWith('...') && !typify(paramType as any).endsWith('[]')
            ? '[]'
            : ''
        }`;
      }

      if (param.type !== 'Function' && type.substr(0, 1).toLowerCase() !== type.substr(0, 1)) {
        type = paramTypePrefix + type;
      }

      return `${name}${optional}: ${type}`;
    })
    .join(', ')}${
    includeType ? `) => ${moduleMethod.returns ? typify(moduleMethod.returns) : 'void'}` : ''
  }`;
};
