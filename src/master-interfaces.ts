import _ from 'lodash';
import d from 'debug';
import { ParsedDocumentationResult } from '@electron/docs-parser';
const debug = d('master-interface');

export const generateMasterInterfaces = (
  API: ParsedDocumentationResult,
  interfaceKeys: string[],
  addToOutput: (lines: string[], sep?: string) => void,
) => {
  // Generate Main / Renderer process interfaces
  const CommonNamespace = ['namespace Common {'];
  const MainNamespace = ['namespace Main {'];
  const RendererNamespace = ['namespace Renderer {'];
  const MainInterfaceForRemote = ['interface RemoteMainInterface {'];
  const constDeclarations: string[] = [];
  const EMRI: Record<string, boolean> = {};

  const classify = (moduleName: string) => {
    switch (moduleName.toLowerCase()) {
      case 'session':
        return 'session';
      case 'nativeimage':
        return 'nativeImage';
      case 'webcontents':
        return 'webContents';
      default:
        return moduleName;
    }
  };

  API.forEach((module, index) => {
    if (module.name === 'process') return;
    let TargetNamespace;
    const isClass =
      module.type === 'Class' ||
      API.some(
        (tModule, tIndex) =>
          index !== tIndex && tModule.name.toLowerCase() === module.name.toLowerCase(),
      );
    const moduleString = isClass ? `  class ${_.upperFirst(module.name)} extends Electron.${_.upperFirst(module.name)} {}` : '';
    if (module.type === 'Structure') {
      // We must be a structure or something
      return;
    }
    const newConstDeclarations: string[] = [];
    if (!isClass || module.name !== classify(module.name)) {
      if (isClass) {
        newConstDeclarations.push(
          `type ${classify(module.name)} = ${_.upperFirst(module.name)};`,
          `const ${classify(module.name)}: typeof ${_.upperFirst(module.name)};`,
        );
      } else {
        newConstDeclarations.push(`const ${classify(module.name)}: ${_.upperFirst(module.name)};`);
      }
    }
    constDeclarations.push(...newConstDeclarations);
    if (module.process.main && module.process.renderer) {
      TargetNamespace = CommonNamespace;
    } else if (module.process.main) {
      TargetNamespace = MainNamespace;
    } else if (module.process.renderer) {
      TargetNamespace = RendererNamespace;
    }
    if (module.process.main && !EMRI[classify(module.name).toLowerCase()]) {
      MainInterfaceForRemote.push(`  ${classify(module.name)}: ${isClass ? 'typeof ' : ''}${_.upperFirst(
        module.name,
      )};`)
    }
    if (TargetNamespace) {
      debug(classify(module.name).toLowerCase(), EMRI[classify(module.name).toLowerCase()]);
      if (!EMRI[classify(module.name).toLowerCase()]) {
        if (moduleString) TargetNamespace.push(moduleString);
      }
      EMRI[classify(module.name).toLowerCase()] = true;
      TargetNamespace.push(...newConstDeclarations.map(s => `  ${s.substr(0, s.length - 1)}`));
    }
  });

  addToOutput([
    ...MainInterfaceForRemote,
    '}'
  ])

  for (const interfaceKey of interfaceKeys) {
    const alias = `  type ${interfaceKey} = Electron.${interfaceKey}`;
    CommonNamespace.push(alias);
    MainNamespace.push(alias);
    RendererNamespace.push(alias);
  }

  CommonNamespace.push('}');
  MainNamespace.push('}');
  RendererNamespace.push('}');

  const withSemicolons = (lines: string[]) => {
    return lines.map(l => l.endsWith('{') || l.endsWith('}') ? l : `${l};`);
  }
  addToOutput(['']);
  addToOutput(withSemicolons(CommonNamespace));
  addToOutput(withSemicolons(MainNamespace));
  addToOutput(withSemicolons(RendererNamespace));
  addToOutput(constDeclarations);
};
