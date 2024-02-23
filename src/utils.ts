import chalk from 'chalk';
import {
  TypeInformation,
  DetailedStringType,
  ModuleDocumentationContainer,
  MethodDocumentationBlock,
  DetailedObjectType,
  DocumentationBlock,
  DetailedFunctionType,
  DocumentationTag,
  ParsedDocumentationResult,
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

const earliest = (a: number, b: number) => {
  if (a === -1 && b === -1) return -2;
  if (a === -1) return b;
  if (b === -1) return a;
  return Math.min(a, b);
};

export const wrapComment = (comment: string, additionalTags: DocumentationTag[] = []): string[] => {
  if (!comment && !additionalTags.length) return [];
  comment = comment.replace(/^\(optional\)(?: - )?/gi, '');
  if (!comment && !additionalTags.length) return [];
  const result = ['/**'];
  while (comment.length > 0) {
    // Default the cut point to be the first "space" or "newline" character
    let index = earliest(comment.indexOf(' '), comment.indexOf('\n'));
    for (let i = 0; i <= 80; i++) {
      if (comment[i] === ' ') index = i;
      if (comment[i] === '\n') {
        index = i;
        break;
      }
    }
    if (comment.length <= 80 && !comment.includes('\n')) {
      index = 80;
    }
    // If we didn't find a good cut point (i.e. there isn't a good cut point anywhere)
    // then let's just take the whole thing it's probably one long word
    if (index === -2) {
      index = comment.length;
    }
    result.push(` * ${comment.substring(0, index)}`);
    comment = comment.substring(index + 1);
  }
  if (additionalTags.length) {
    if (result.length > 1) result.push(' *');
    const nodePlatforms: string[] = [];
    result.push(
      ...additionalTags
        .map(tag => {
          switch (tag) {
            case DocumentationTag.STABILITY_DEPRECATED:
              return ' * @deprecated';
            case DocumentationTag.STABILITY_EXPERIMENTAL:
              return ' * @experimental';
            case DocumentationTag.OS_LINUX:
              nodePlatforms.push('linux');
              break;
            case DocumentationTag.OS_MACOS:
              nodePlatforms.push('darwin');
              break;
            case DocumentationTag.OS_MAS:
              nodePlatforms.push('mas');
              break;
            case DocumentationTag.OS_WINDOWS:
              nodePlatforms.push('win32');
              break;
          }
          return '';
        })
        .filter(tag => tag),
    );
    if (nodePlatforms.length) {
      result.push(` * @platform ${nodePlatforms.join(',')}`);
    }
  }
  return result.concat(' */');
};

const prefixTypeForSafety = (type: string) => {
  if (
    type !== 'Object' &&
    typeof type === 'string' &&
    !isPrimitive(type) &&
    !isBuiltIn(type) &&
    !/\(\| /gi.test(type)
  ) {
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

  if (!type)
    throw new Error('Missing type provided to typify, something is wrong in the documentation');

  let innerTypes: TypeInformation[] | undefined;
  let typeAsString: string | TypeInformation | TypeInformation[] = type;

  if (typeof type === 'object') {
    if (!type.type) {
      console.error(type);
      throw new Error(
        'Missing type property on object provided to typify, something is wrong in the documentation',
      );
    }

    let newType = type.type;

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
      throw new Error('Untyped "Array" as return type');
    }
    case 'true':
    case 'false':
      throw new Error('"true" or "false" provided as return value, inferring "Boolean" type');
    case '[objects]':
      throw new Error(
        '[Objects] is not a valid array definition, please conform to the styleguide',
      );
    case 'object':
      throw new Error(
        'Unstructured "Object" type specified, you must specify either the type of the object or provide the key structure inline in the documentation',
      );
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
      throw new Error('Promise with missing inner type');
    case 'record':
      if (innerTypes && innerTypes.length === 2) {
        return `Record<${typify(innerTypes[0])}, ${typify(innerTypes[1])}>`;
      }
      throw new Error('Record with missing inner types');
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
export const isEmitter = (doc: ParsedDocumentationResult[0]) => {
  // Is a module, has events, is an eventemitter
  if (doc.type === 'Module' && doc.events.length) {
    return true;
  }

  // Is a class, has instance events, is an eventemitter
  if (doc.type === 'Class' && doc.instanceEvents.length) {
    return true;
  }

  // Implements the on and removeListener methods normally means
  // it's an EventEmitter wrapper like ipcMain or ipcRenderer
  const relevantMethods =
    doc.type === 'Class' ? doc.instanceMethods : doc.type === 'Module' ? doc.methods : [];
  if (
    relevantMethods.find(m => m.name === 'on') &&
    relevantMethods.find(m => m.name === 'removeListener')
  ) {
    return true;
  }

  // Structure and Elements are not eventemitters, so bail here
  return false;
};
export const isPrimitive = (type: string) => {
  const primitives = ['boolean', 'number', 'any', 'string', 'void', 'unknown'];
  return primitives.indexOf(type.toLowerCase().replace(/\[\]/g, '')) !== -1;
};
export const isBuiltIn = (type: string) => {
  const builtIns = [
    'promise',
    'buffer',
    'int8array',
    'uint8array',
    'uint8clampedarray',
    'int16array',
    'uint16array',
    'int32array',
    'uint32array',
    'float32array',
    'float64array',
    'bigint64array',
    'biguint64array',
    'globalresponse',
  ];
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
  topLevelModuleMethod?: MethodDocumentationBlock,
): string => {
  const createMethodObjectParamType = (
    objectParam: DetailedObjectType & TypeInformation & DocumentationBlock & { required: boolean },
  ) => {
    if ('constructor' === moduleMethod.name.toLowerCase()) {
      objectParam.name = objectParam.name || 'options';
    }
    if (objectParam.name === 'options') {
      if (
        ['show', 'hide', 'open', 'close', 'start', 'stop', 'constructor', 'print'].includes(
          moduleMethod.name.toLowerCase(),
        )
      ) {
        return paramInterfaces.createParamInterface(
          objectParam,
          _.upperFirst(module.name) + _.upperFirst(moduleMethod.name),
        );
      }

      return paramInterfaces.createParamInterface(objectParam, _.upperFirst(moduleMethod.name));
    }

    if (['set', 'get'].includes(moduleMethod.name.toLowerCase())) {
      return paramInterfaces.createParamInterface(
        objectParam,
        _.upperFirst(module.name) + _.upperFirst(moduleMethod.name),
      );
    }

    return paramInterfaces.createParamInterface(
      objectParam,
      '',
      _.upperFirst(moduleMethod.name),
      topLevelModuleMethod ? _.upperFirst(topLevelModuleMethod.name) : '',
    );
  };
  return `${includeType ? '(' : ''}${(moduleMethod.parameters || [])
    .map(param => {
      let paramType: string | null = param as any;

      const objectParam = param as DetailedObjectType &
        TypeInformation &
        DocumentationBlock & { required: boolean };
      if (param.type === 'Object' && objectParam.properties && objectParam.properties.length) {
        // Check if we have the same structure for a different name
        paramType = createMethodObjectParamType(objectParam);
      }

      if (Array.isArray(param.type)) {
        param.type = param.type.map(paramType => {
          const functionParam = paramType as DetailedFunctionType;
          const objectParam = paramType as DetailedObjectType &
            TypeInformation &
            DocumentationBlock & { required: boolean };
          if (paramType.type === 'Function' && functionParam.parameters) {
            return Object.assign({}, paramType, {
              type: genMethodString(
                paramInterfaces,
                module,
                {
                  name: _.upperFirst(moduleMethod.name) + _.upperFirst(param.name),
                  ...functionParam,
                } as any /* FIXME: */,
                true,
                '',
                moduleMethod,
              ),
            });
          } else if (paramType.type === 'Object' && objectParam.properties) {
            return {
              ...objectParam,
              type: createMethodObjectParamType({
                ...objectParam,
                name: param.name,
              }),
            };
          }
          return paramType;
        });
      }
      const functionParam = param as DetailedFunctionType;
      if (param.type === 'Function' && functionParam.parameters) {
        paramType = genMethodString(
          paramInterfaces,
          module,
          functionParam as any /* FIXME: */,
          true,
          '',
          moduleMethod,
        );
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
