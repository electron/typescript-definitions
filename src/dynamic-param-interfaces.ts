import _ from 'lodash';
import * as utils from './utils';
import d from 'debug';
import {
  EventParameterDocumentation,
  DetailedObjectType,
  ParsedDocumentationResult,
  DetailedFunctionType,
} from '@electron/docs-parser';
import chalk from 'chalk';
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
  _.map(props, p => {
    const { description, ...toReturn } = p;

    return toReturn;
  }).sort((a, b) => a.name.localeCompare(b.name));

// Given a parameter create a new interface and return it's name
// IName is the proposed interface name prefix
// backupIName is a slightly longer IName in case IName is already taken
const createParamInterface = (
  param: ParamInterface,
  IName = '',
  backupIName = '',
  finalBackupIName = '',
): string => {
  let argType = polite(IName) + _.upperFirst(_.camelCase(param.name));
  let argName = param.name;
  // TODO: Note.  It is still possible for even backupIName to be already used
  let usingExistingParamInterface = false;
  _.forIn(paramInterfacesToDeclare, (value, key) => {
    const test = _.assign({}, param, { name: argName, tName: argType });
    if (_.isEqual(test, value)) {
      usingExistingParamInterface = true;
      debug(
        chalk.cyan(
          `Using existing type for param name ${argType} --> ${key} in Interface: ${_.upperFirst(
            param.tName,
          )} --- This is because their structure is identical`,
        ),
      );
      argType = key;
      return false;
    }
  });
  if (usingExistingParamInterface) {
    return argType;
  }
  if (
    paramInterfacesToDeclare[argType] &&
    !_.isEqual(
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
  return argType;
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
      .forEach(paramKey => {
        if (paramKey === 'Event') {
          delete paramInterfacesToDeclare[paramKey];
          return;
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
          if (!_.isEqual(toDeclareCheck, declaredCheck)) {
            throw new Error('Ruh roh, "' + paramKey + '" is already declared');
          }
          delete paramInterfacesToDeclare[paramKey];
          return;
        }
        declared[paramKey] = paramInterfacesToDeclare[paramKey];
        const param = paramInterfacesToDeclare[paramKey];
        const paramAPI: string[] = [];
        paramAPI.push(
          `interface ${_.upperFirst(param.tName)}${
            param.extends ? ` extends ${param.extends}` : ''
          } {`,
        );

        param.properties = param.properties || [];
        param.properties.forEach(paramProperty => {
          if (paramProperty.description) {
            utils.extendArray(
              paramAPI,
              utils.wrapComment(paramProperty.description, paramProperty.additionalTags),
            );
          }

          if (!Array.isArray(paramProperty.type) && paramProperty.type.toLowerCase() === 'object') {
            let argType =
              (paramProperty as any).__type || _.upperFirst(_.camelCase(paramProperty.name));
            if (API.some(a => a.name === argType)) {
              paramProperty.type = argType;
              debug(
                chalk.red(
                  `Auto-correcting type from Object --> ${argType} in Interface: ${_.upperFirst(
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
            paramProperty.type = paramProperty.type.map(paramPropertyType => {
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
                // return Object.assign({}, paramPropertyType, { typeName: utils.genMethodString(module.exports, param, paramProperty, paramProperty.parameters, paramProperty.returns, true) })
              }
              return paramPropertyType;
            });
          }
          if (
            !Array.isArray(paramProperty.type) &&
            paramProperty.type.toLowerCase() === 'function'
          ) {
            // FIXME: functionProp should slot in here perfectly
            paramAPI.push(
              `${paramProperty.name}${
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
              `${paramProperty.name}${utils.isOptional(paramProperty) ? '?' : ''}: ${utils.typify(
                paramProperty,
              )};`,
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
