import { ParsedDocumentationResult, MethodDocumentationBlock } from '@electron/docs-parser';
import chalk from 'chalk';
import d from 'debug';
import _ from 'lodash';

import * as utils from './utils.js';

const debug = d('remap-optionals');

export const remapOptionals = (API: ParsedDocumentationResult) => {
  API.forEach((module) => {
    // Remap optionals to actually be multiple methods when appropriate
    const remap = (attr: string) => {
      const moreMethods: MethodDocumentationBlock[] = [];
      const attrs = ((module as any)[attr] as MethodDocumentationBlock[]) || [];
      attrs.forEach((method) => {
        if (!method.parameters) return;
        if ((method as any).__handled) return;
        let optionalFound = false;
        _.concat([], method.parameters).forEach((param, index) => {
          if (optionalFound && !utils.isOptional(param)) {
            debug(
              chalk.cyan(
                `Duplicating method due to prefixed optional: ${method.name} Slicing at: ${index}`,
              ),
            );
            moreMethods.push(
              Object.assign({}, _.cloneDeep(method), {
                parameters: [..._.cloneDeep(method.parameters)].filter((tParam, pIndex) => {
                  if (pIndex >= index) return true;
                  return !utils.isOptional(tParam);
                }),
              }),
            );
            for (let i = 0; i < index; i++) {
              if (method.parameters[i].description) {
                method.parameters[i].description = method.parameters[i].description.replace(
                  /optional/gi,
                  '',
                );
              }
              method.parameters[i].required = true;
            }
            (method as any).__handled = true;
          }
          optionalFound = optionalFound || utils.isOptional(param);
        });
      });
      attrs.push(...moreMethods);
    };

    remap('methods');
    remap('instanceMethods');
    remap('staticMethods');
  });
};
