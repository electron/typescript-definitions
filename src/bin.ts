#!/usr/bin/env node

import * as fs from 'fs-extra';
import minimist from 'minimist';
import ora from 'ora';
import * as path from 'path';
import pretty from 'pretty-ms';

import chalk from 'chalk';
import { generateDefinitions } from '.';

const args = minimist(process.argv);

const { api, outDir, help } = args;

if (help) {
  console.info(
    chalk.cyan(
      'Usage: electron-typescript-definitions --api ../electron-api.json [--out-dir ../electron-out]',
    ),
  );
  process.exit(0);
}

const runner = ora(chalk.yellow('Checking argv')).start();

if (typeof api !== 'string') {
  runner.fail(chalk.red('Missing required --api argument.  "--api ../electron-api.json"'));
  process.exit(1);
}

const resolvedApi = path.isAbsolute(api) ? api : path.resolve(process.cwd(), api);
if (!fs.pathExistsSync(resolvedApi)) {
  runner.fail(`${chalk.red('Resolved directory does not exist:')} ${chalk.cyan(resolvedApi)}`);
  process.exit(1);
}

const resolvedOutDir =
  typeof outDir === 'string'
    ? path.isAbsolute(outDir)
      ? outDir
      : path.resolve(process.cwd(), outDir)
    : process.cwd();

runner.text = chalk.cyan(`Generating API in directory: ${chalk.yellow(`"${resolvedOutDir}"`)}`);

const start = Date.now();
const resolvedFilePath = path.resolve(resolvedOutDir, './electron.d.ts');

fs.mkdirp(resolvedOutDir).then(() =>
  generateDefinitions({
    electronApi: require(resolvedApi),
  })
    .then(data => fs.writeFile(resolvedFilePath, data))
    .then(() =>
      runner.succeed(
        `${chalk.green('Electron Typescript Definitions generated in')} ${chalk.yellow(
          `"${resolvedFilePath}"`,
        )} took ${chalk.cyan(pretty(Date.now() - start))}`,
      ),
    )
    .catch(err => {
      console.error(err);
      process.exit(1);
    }),
);
