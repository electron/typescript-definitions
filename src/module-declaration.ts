import _ from 'lodash';
import { DynamicParamInterfaces } from './dynamic-param-interfaces';
import * as utils from './utils';
import {
  ParsedDocumentationResult,
  ModuleDocumentationContainer,
  ClassDocumentationContainer,
  StructureDocumentationContainer,
  DocumentationBlock,
  MethodDocumentationBlock,
  DetailedObjectType,
  TypeInformation,
  DetailedFunctionType,
  ElementDocumentationContainer,
  DocumentationTag,
  PropertyDocumentationBlock,
  DetailedEventType,
  DetailedEventReferenceType,
} from '@electron/docs-parser';

const modules: Record<string, string[]> = {};

export const generateModuleDeclaration = (
  module:
    | ModuleDocumentationContainer
    | ClassDocumentationContainer
    | StructureDocumentationContainer
    | ElementDocumentationContainer,
  index: number,
  API: ParsedDocumentationResult,
) => {
  const moduleAPI = modules[_.upperFirst(module.name)] || [];
  const newModule = !modules[_.upperFirst(module.name)];
  const isStaticVersion =
    module.type === 'Module' &&
    API.some(
      (tModule, tIndex) =>
        index !== tIndex && tModule.name.toLowerCase() === module.name.toLowerCase(),
    );
  const isClass = module.type === 'Class' || isStaticVersion;
  const parentModules: ParsedDocumentationResult = [];
  let parentModule:
    | ModuleDocumentationContainer
    | ClassDocumentationContainer
    | StructureDocumentationContainer
    | ElementDocumentationContainer
    | undefined = module;
  while (parentModule && parentModule.extends) {
    parentModule = API.find(m => m.name === parentModule!.extends);
    if (parentModule) parentModules.push(parentModule);
  }

  // Interface Declaration
  if (newModule) {
    if (module.type !== 'Structure') {
      if (utils.isEmitter(module)) {
        moduleAPI.push(
          `${isClass ? 'class' : 'interface'} ${_.upperFirst(
            module.name,
          )} extends ${module.extends || (isClass ? 'NodeEventEmitter' : 'NodeJS.EventEmitter')} {`,
        );
        moduleAPI.push('', `// Docs: ${module.websiteUrl}`, '');
      } else {
        moduleAPI.push(`${isClass ? 'class' : 'interface'} ${_.upperFirst(module.name)} {`);
        moduleAPI.push('', `// Docs: ${module.websiteUrl}`, '');
      }
    } else {
      moduleAPI.push(
        `interface ${_.upperFirst(module.name)}${
          module.extends ? ` extends ${module.extends}` : ''
        } {`,
      );
      moduleAPI.push('', `// Docs: ${module.websiteUrl}`, '');
    }
  }

  // Event Declaration
  if (module.type !== 'Element') {
    // To assist with declaration merging we define all parent events in this class too
    _.concat(
      [],
      module.instanceEvents || [],
      module.events || [],
      ...parentModules.map(m => m.events || []),
      ...parentModules.map(m => m.instanceEvents || []),
    )
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(moduleEvent => {
        utils.extendArray(
          moduleAPI,
          utils.wrapComment(moduleEvent.description, moduleEvent.additionalTags),
        );
        let listener = 'Function';

        if (moduleEvent.parameters && moduleEvent.parameters.length) {
          const args: string[] = [];
          const indent = _.repeat(' ', moduleEvent.name.length + 29);

          moduleEvent.parameters.forEach((eventListenerArg, index) => {
            let argString = '';
            const additionalTags = (eventListenerArg as any).additionalTags || [];
            if (eventListenerArg.description || additionalTags.length) {
              if (index === 0) argString += `\n${indent}`;
              argString += utils
                .wrapComment(eventListenerArg.description, additionalTags)
                .map((l, i) => `${l}\n${indent}`)
                .join('');
            }

            let argType: string | null = null;
            const objectListenerArg = eventListenerArg as (DetailedObjectType) &
              DocumentationBlock &
              TypeInformation & { required: boolean };
            if (
              eventListenerArg.type === 'Object' &&
              objectListenerArg.properties &&
              objectListenerArg.properties.length
            ) {
              // Check if we have the same structure for a different name
              argType = DynamicParamInterfaces.createParamInterface(
                objectListenerArg,
                eventListenerArg.name === 'params'
                  ? _.upperFirst(_.camelCase(moduleEvent.name))
                  : undefined,
                _.upperFirst(_.camelCase(moduleEvent.name)),
              );
            }

            const eventGenericListenerArg = eventListenerArg as (DetailedEventType) &
              DocumentationBlock &
              TypeInformation & { required: boolean };
            const eventReferenceListenerArg = eventListenerArg as (DetailedEventReferenceType) &
              DocumentationBlock &
              TypeInformation & { required: boolean };

            if (eventGenericListenerArg.type === 'Event') {
              let eventParamsType = '';
              if (
                eventGenericListenerArg.eventProperties &&
                eventGenericListenerArg.eventProperties.length
              ) {
                const fakeObject: any = {
                  name: 'EventParams',
                  type: 'Object',
                  collection: false,
                  properties: eventGenericListenerArg.eventProperties,
                };
                eventParamsType = DynamicParamInterfaces.createParamInterface(
                  fakeObject,
                  `${_.upperFirst(_.camelCase(module.name))}${_.upperFirst(
                    _.camelCase(moduleEvent.name),
                  )}`,
                );
              }
              if (eventReferenceListenerArg.eventPropertiesReference) {
                eventParamsType = utils.typify(eventReferenceListenerArg.eventPropertiesReference);
              }
              argType = eventParamsType ? `Event<${eventParamsType}>` : 'Event';
            }

            let newType = argType || utils.typify(eventListenerArg);
            const functionListenerArg = (eventListenerArg as any) as DetailedFunctionType &
              DocumentationBlock &
              TypeInformation;
            if (newType === 'Function') {
              newType = utils.genMethodString(
                DynamicParamInterfaces,
                module,
                functionListenerArg as any, // FIXME: <--
                undefined,
              );
            }

            args.push(
              `${argString}${utils.paramify(eventListenerArg.name)}${
                utils.isOptional(eventListenerArg) ? '?' : ''
              }: ${newType}`,
            );
          });
          listener = `(${args.join(`,\n${indent}`)}) => void`;
        }

        const methods = ['on', 'off', 'once', 'addListener', 'removeListener'];
        for (const method of methods) {
          if (methods.indexOf(method) > 0) {
            utils.extendArray(moduleAPI, utils.wrapComment('', moduleEvent.additionalTags));
          }
          moduleAPI.push(`${method}(event: '${moduleEvent.name}', listener: ${listener}): this;`);
        }
      });
  }

  // Dom Element Events
  if (module.type === 'Element') {
    if (module.events) {
      module.events.forEach(domEvent => {
        utils.extendArray(
          moduleAPI,
          utils.wrapComment(domEvent.description, domEvent.additionalTags),
        );
        let eventType = 'DOMEvent';

        if (domEvent.parameters && domEvent.parameters.length) {
          const fakeObject: any = {
            name: 'event',
            type: 'Object',
            collection: false,
            properties: [],
            extends: 'DOMEvent',
          };

          domEvent.parameters.forEach((eventListenerProp, index) => {
            if (eventListenerProp.name === 'result') {
              (eventListenerProp as any).__type = `${_.upperFirst(
                _.camelCase(domEvent.name),
              )}Result`;
            }
            fakeObject.properties.push(eventListenerProp);
          });

          eventType = DynamicParamInterfaces.createParamInterface(
            fakeObject,
            _.upperFirst(_.camelCase(domEvent.name)),
          );
        }

        const methods = ['addEventListener', 'removeEventListener'];
        for (const method of methods) {
          if (methods.indexOf(method) > 0) {
            utils.extendArray(moduleAPI, utils.wrapComment('', domEvent.additionalTags));
          }
          moduleAPI.push(
            `${method}(event: '${domEvent.name}', listener: (event: ${eventType}) => void${
              method === 'addEventListener' ? ', useCapture?: boolean' : ''
            }): this;`,
          );
        }
      });

      // original overloads copied from HTMLElement, because they are not inherited
      moduleAPI.push(
        `addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any, useCapture?: boolean): void;`,
      );
      moduleAPI.push(
        `addEventListener(type: string, listener: EventListenerOrEventListenerObject, useCapture?: boolean): void;`,
      );
      moduleAPI.push(
        `removeEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any, useCapture?: boolean): void;`,
      );
      moduleAPI.push(
        `removeEventListener(type: string, listener: EventListenerOrEventListenerObject, useCapture?: boolean): void;`,
      );
    }
  }

  const returnsThis = (moduleMethod: Pick<DocumentationBlock, 'name'>) =>
    ['on', 'off', 'once', 'addListener', 'removeAllListeners', 'removeListener'].includes(
      moduleMethod.name,
    );

  const addMethod = (moduleMethod: MethodDocumentationBlock, prefix = '') => {
    utils.extendArray(
      moduleAPI,
      utils.wrapComment(moduleMethod.description, moduleMethod.additionalTags),
    );
    let returnType: string | TypeInformation = returnsThis(moduleMethod) ? 'this' : 'void';

    if (moduleMethod.returns) {
      returnType = moduleMethod.returns;
      // Account for methods on the process module that return a custom type/structure, we need to reference the Electron namespace to use these types
      if (
        module.name === 'process' &&
        moduleMethod.returns.type !== 'Object' &&
        typeof moduleMethod.returns.type === 'string' &&
        !utils.isPrimitive(moduleMethod.returns.type) &&
        !utils.isBuiltIn(moduleMethod.returns.type)
      ) {
        returnType = `Electron.${moduleMethod.returns.type}`;
      }
    }

    if (returnType === 'Object' || (returnType as TypeInformation).type === 'Object') {
      returnType = DynamicParamInterfaces.createParamInterface(
        moduleMethod.returns! as any,
        _.upperFirst(moduleMethod.name),
      );

      // The process module is not in the Electron namespace so we need to reference the Electron namespace to use these types
      if (module.name === 'process') {
        returnType = `Electron.${returnType}`;
      }
    }

    const paramString = utils.genMethodString(
      DynamicParamInterfaces,
      module,
      moduleMethod,
      false,
      module.name === 'process' ? 'Electron.' : '',
    );

    moduleAPI.push(
      `${prefix}${moduleMethod.name}${moduleMethod.rawGenerics || ''}(${paramString})${
        moduleMethod.name === 'constructor'
          ? ''
          : `: ${utils.typify(
              returnType as TypeInformation,
              `${_.upperFirst(moduleMethod.name)}ReturnValue`,
            )}`
      };`,
    );
  };

  // Class constructor
  if (module.constructorMethod) {
    addMethod({
      name: 'constructor',
      ...module.constructorMethod,
      description: module.name,
      returns: null,
      additionalTags: [],
    });
  }

  // Static Method Declaration
  if (module.staticMethods) {
    module.staticMethods
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(m => addMethod(m, 'static '));
  }

  // Method Declaration
  if (module.methods) {
    module.methods
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(m => addMethod(m, isStaticVersion ? 'static ' : ''));
  }

  // Instance Method Declaration
  if (module.instanceMethods) {
    module.instanceMethods.sort((a, b) => a.name.localeCompare(b.name)).forEach(m => addMethod(m));
  }

  // Class properties
  if (module.instanceProperties) {
    module.instanceProperties
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(prop => {
        const isOptional = !prop.required ? '?' : '';
        const isReadonly = prop.additionalTags.includes(DocumentationTag.AVAILABILITY_READONLY)
          ? 'readonly '
          : '';
        if (prop.description) {
          utils.extendArray(moduleAPI, utils.wrapComment(prop.description, prop.additionalTags));
        }
        moduleAPI.push(`${isReadonly}${prop.name}${isOptional}: ${utils.typify(prop)};`);
      });
  }

  // Class Static propreties
  if (module.staticProperties) {
    module.staticProperties
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(prop => {
        const isReadonly = prop.additionalTags.includes(DocumentationTag.AVAILABILITY_READONLY)
          ? 'readonly '
          : '';
        if (prop.description) {
          utils.extendArray(moduleAPI, utils.wrapComment(prop.description, prop.additionalTags));
        }
        moduleAPI.push(`static ${isReadonly}${prop.name}: ${utils.typify(prop)};`);
      });
  }

  // Structure properties
  const pseudoProperties = module.properties || [];
  if (pseudoProperties.length) {
    pseudoProperties
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(p => {
        let paramType = p;
        let type: string = '';
        if (paramType.type === 'Object') {
          type = DynamicParamInterfaces.createParamInterface(p as any, '');
        } else if (Array.isArray(paramType.type)) {
          paramType.type = paramType.type.map(t =>
            t.type !== 'Object'
              ? t
              : {
                  ...t,
                  type: DynamicParamInterfaces.createParamInterface(
                    {
                      ...p,
                      ...t,
                    } as any,
                    '',
                  ),
                },
          );
        }

        const isStatic = isStaticVersion ? 'static ' : '';
        const isOptional = utils.isOptional(p) ? '?' : '';
        const isReadonly = p.additionalTags.includes(DocumentationTag.AVAILABILITY_READONLY)
          ? 'readonly '
          : '';
        type = type || utils.typify(paramType);

        if (type === 'Function') {
          type = utils.genMethodString(
            DynamicParamInterfaces,
            module,
            p as any, // FIXME: <--
            undefined,
          );
        }

        utils.extendArray(moduleAPI, utils.wrapComment(p.description, p.additionalTags));
        if (module.name === 'process' && p.name === 'versions') return;

        if (p.name.match(/^\d/)) {
          // Wrap key in quotes if it starts with a number, e.g. `2d_canvas`
          moduleAPI.push(`'${isStatic}${isReadonly}${p.name}${isOptional}': ${type};`);
        } else {
          moduleAPI.push(`${isStatic}${isReadonly}${p.name}${isOptional}: ${type};`);
        }
      });
  }

  // Save moduleAPI for later reuse
  modules[_.upperFirst(module.name)] = moduleAPI;
};

export const getModuleDeclarations = () => modules;
