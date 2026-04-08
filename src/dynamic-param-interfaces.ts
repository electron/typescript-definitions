import { isDeepStrictEqual } from 'node:util';

import {
  EventParameterDocumentation,
  DetailedObjectType,
  ParsedDocumentationResult,
  DetailedFunctionType,
  DocumentationTag,
} from '@electron/docs-parser';
import chalk from 'chalk';
import d from 'debug';

import * as utils from './utils.js';
import { upperFirst, lowerFirst, camelCase } from './utils.js';

const debug = d('dynamic-param');

type ParamInterface = EventParameterDocumentation &
  DetailedObjectType & {
    /**
     * The original arg type
     */
    tName?: string;
    extends?: string;
  };

// Object of interfaces we need to declare
const paramInterfacesToDeclare: Record<string, ParamInterface> = {};

// Interfaces that we would declare with these prefixes should remove them before declaration
const impoliteInterfaceNames = ['Get', 'Set', 'Show'];
const polite = (s: string): string => {
  for (let i = 0; i < impoliteInterfaceNames.length; i++) {
    if (s.startsWith(impoliteInterfaceNames[i]))
      return polite(s.substring(impoliteInterfaceNames[i].length));
  }
  return s;
};

// Ignore descriptions when comparing objects
const ignoreDescriptions = <T extends EventParameterDocumentation>(
  props: T[],
): Pick<T, Exclude<keyof T, 'description'>>[] =>
  props
    .map((p) => {
      const { description, ...toReturn } = p;

      return toReturn;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

const noDescriptionCache = new WeakMap();
const unsetDescriptions = (o: any): any => {
  if (noDescriptionCache.has(o)) return noDescriptionCache.get(o);
  if (typeof o !== 'object' || !o) return o;
  const val = Array.isArray(o)
    ? o.map((item) => unsetDescriptions(item))
    : Object.keys(o).reduce((accum: any, key: string) => {
        if (key === 'description') return accum;
        accum[key] = unsetDescriptions(o[key]);
        return accum;
      }, {});
  noDescriptionCache.set(o, val);
  return val;
};

// Given a parameter create a new interface and return it's name + array modifier
// IName is the proposed interface name prefix
// backupIName is a slightly longer IName in case IName is already taken
const createParamInterface = (
  param: ParamInterface,
  IName = '',
  backupIName = '',
  finalBackupIName = '',
): string => {
  const maybeArray = (type: string) => (param.collection ? `Array<${type}>` : type);
  const potentialExistingArgType = polite(IName);
  const potentialExistingArgName = lowerFirst(polite(IName));
  let argType = polite(IName) + upperFirst(camelCase(param.name));
  let argName = param.name;
  // TODO: Note.  It is still possible for even backupIName to be already used
  let usingExistingParamInterface = false;
  for (const [key, value] of Object.entries(paramInterfacesToDeclare)) {
    const test = unsetDescriptions(
      Object.assign({}, param, {
        name: argName,
        tName: argType,
        required: value.required,
        additionalTags: (param as any).additionalTags || [],
      }),
    );
    const potentialTest = unsetDescriptions(
      Object.assign({}, param, {
        name: potentialExistingArgName,
        tName: potentialExistingArgType,
        required: value.required,
        additionalTags: (param as any).additionalTags || [],
      }),
    );
    const unsetValue = unsetDescriptions(value);
    if (isDeepStrictEqual(test, unsetValue) || isDeepStrictEqual(potentialTest, unsetValue)) {
      usingExistingParamInterface = true;
      debug(
        chalk.cyan(
          `Using existing type for param name ${argType} --> ${key} in Interface: ${upperFirst(
            param.tName,
          )} --- This is because their structure is identical`,
        ),
      );
      argType = key;
      break;
    }
  }
  if (usingExistingParamInterface) {
    return maybeArray(argType);
  }
  if (
    paramInterfacesToDeclare[argType] &&
    !isDeepStrictEqual(
      ignoreDescriptions(paramInterfacesToDeclare[argType].properties),
      ignoreDescriptions(param.properties),
    )
  ) {
    if (backupIName) {
      return createParamInterface(param, backupIName, finalBackupIName);
    }
    console.error(
      argType,
      IName,
      backupIName,
      finalBackupIName,
      ignoreDescriptions(paramInterfacesToDeclare[argType].properties),
      '\n',
      ignoreDescriptions(param.properties),
    );
    throw Error(`Interface "${argType}" has already been declared`);
  }
  // Update the params interfaces we still have to define
  paramInterfacesToDeclare[argType] = param;
  paramInterfacesToDeclare[argType].name = argName;
  paramInterfacesToDeclare[argType].tName = argType;
  return maybeArray(argType);
};

const flushParamInterfaces = (
  API: ParsedDocumentationResult,
  addToOutput: (lines: string[]) => void,
) => {
  const declared: Record<string, ParamInterface> = {};

  while (Object.keys(paramInterfacesToDeclare).length > 0) {
    const nestedInterfacesToDeclare: Record<string, ParamInterface> = {};

    Object.keys(paramInterfacesToDeclare)
      .sort((a, b) =>
        paramInterfacesToDeclare[a].tName!.localeCompare(paramInterfacesToDeclare[b].tName!),
      )
      .forEach((paramKey) => {
        if (paramKey === 'Event') {
          throw 'Unexpected dynamic Event type, should be routed through the Event handler';
        }
        if (declared[paramKey]) {
          const toDeclareCheck: ParamInterface = Object.assign(
            {},
            paramInterfacesToDeclare[paramKey],
          );
          const declaredCheck: ParamInterface = Object.assign({}, declared[paramKey]);
          for (const prop of ['type', 'collection', 'required', 'description'] as Array<
            keyof ParamInterface
          >) {
            delete toDeclareCheck[prop];
            delete declaredCheck[prop];
          }
          if (!isDeepStrictEqual(toDeclareCheck, declaredCheck)) {
            throw new Error('Ruh roh, "' + paramKey + '" is already declared');
          }
          delete paramInterfacesToDeclare[paramKey];
          return;
        }
        declared[paramKey] = paramInterfacesToDeclare[paramKey];
        const param = paramInterfacesToDeclare[paramKey];
        const paramAPI: string[] = [];
        paramAPI.push(
          `interface ${upperFirst(param.tName)}${
            param.extends ? ` extends ${param.extends}` : ''
          } {`,
        );

        param.properties = param.properties || [];
        param.properties.forEach((paramProperty) => {
          if (paramProperty.description) {
            utils.extendArray(
              paramAPI,
              utils.wrapComment(paramProperty.description, paramProperty.additionalTags),
            );
          }

          if (!Array.isArray(paramProperty.type) && paramProperty.type.toLowerCase() === 'object') {
            let argType =
              (paramProperty as any).__type || upperFirst(camelCase(paramProperty.name));
            if (API.some((a) => a.name === argType)) {
              paramProperty.type = argType;
              debug(
                chalk.red(
                  `Auto-correcting type from Object --> ${argType} in Interface: ${upperFirst(
                    param.tName,
                  )} --- This should be fixed in the docs`,
                ),
              );
            } else {
              nestedInterfacesToDeclare[argType] = paramProperty as ParamInterface;
              nestedInterfacesToDeclare[argType].name = paramProperty.name;
              nestedInterfacesToDeclare[argType].tName = argType;
              paramProperty.type = argType;
            }
          }

          if (Array.isArray(paramProperty.type)) {
            paramProperty.type = paramProperty.type.map((paramPropertyType) => {
              const functionProp = paramPropertyType as DetailedFunctionType;
              if (paramPropertyType.type === 'Function' && functionProp.parameters) {
                return {
                  ...paramPropertyType,
                  // FIXME: functionProp should slot in here perfectly
                  type: utils.genMethodString(
                    DynamicParamInterfaces,
                    param,
                    functionProp as any,
                    true,
                  ),
                };
              } else if (
                typeof paramPropertyType.type === 'string' &&
                paramPropertyType.type.toLowerCase() === 'object'
              ) {
                let argType =
                  (paramProperty as any).__type || upperFirst(camelCase(paramProperty.name));
                if (API.some((a) => a.name === argType)) {
                  paramPropertyType.type = argType;
                  debug(
                    chalk.red(
                      `Auto-correcting type from Object --> ${argType} in Interface: ${upperFirst(
                        param.tName,
                      )} --- This should be fixed in the docs`,
                    ),
                  );
                } else {
                  nestedInterfacesToDeclare[argType] = paramPropertyType as ParamInterface;
                  nestedInterfacesToDeclare[argType].name = paramProperty.name;
                  nestedInterfacesToDeclare[argType].tName = argType;
                  paramPropertyType.type = argType;
                }
              }
              return paramPropertyType;
            });
          }
          const isReadonly = (paramProperty.additionalTags || []).includes(
            DocumentationTag.AVAILABILITY_READONLY,
          )
            ? 'readonly '
            : '';
          if (
            !Array.isArray(paramProperty.type) &&
            paramProperty.type.toLowerCase() === 'function'
          ) {
            // FIXME: functionProp should slot in here perfectly
            paramAPI.push(
              `${isReadonly}${paramProperty.name}${
                utils.isOptional(paramProperty) ? '?' : ''
              }: ${utils.genMethodString(
                DynamicParamInterfaces,
                param,
                paramProperty as any,
                true,
              )};`,
            );
          } else {
            paramAPI.push(
              `${isReadonly}${paramProperty.name}${
                utils.isOptional(paramProperty) ? '?' : ''
              }: ${utils.typify(paramProperty)};`,
            );
          }
        });
        paramAPI.push('}');
        addToOutput(
          paramAPI.map((l, index) => (index === 0 || index === paramAPI.length - 1 ? l : `  ${l}`)),
        );
        delete paramInterfacesToDeclare[paramKey];
      });

    Object.assign(paramInterfacesToDeclare, nestedInterfacesToDeclare);
  }

  return Object.keys(declared);
};

export class DynamicParamInterfaces {
  static createParamInterface = createParamInterface;
  static flushParamInterfaces = flushParamInterfaces;
}

utils.setParamInterfaces(DynamicParamInterfaces);
