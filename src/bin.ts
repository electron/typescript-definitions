#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import chalk from 'chalk';
import ora from 'ora';
import pretty from 'pretty-ms';

import { generateDefinitions } from './index.js';

const {
  values: { api, outDir, help },
} = parseArgs({
  options: {
    api: {
      type: 'string',
    },
    outDir: {
      type: 'string',
      default: process.cwd(),
    },
    help: {
      type: 'boolean',
      default: false,
    },
  },
});

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
if (!fs.existsSync(resolvedApi)) {
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

fs.promises.mkdir(resolvedOutDir, { recursive: true }).then(async () =>
  generateDefinitions({
    electronApi: JSON.parse(await fs.promises.readFile(resolvedApi, 'utf-8')),
  })
    .then((data) => fs.promises.writeFile(resolvedFilePath, data))
    .then(() =>
      runner.succeed(
        `${chalk.green('Electron Typescript Definitions generated in')} ${chalk.yellow(
          `"${resolvedFilePath}"`,
        )} took ${chalk.cyan(pretty(Date.now() - start))}`,
      ),
    )
    .catch((err) => {
      console.error(err);
      process.exit(1);
    }),
);
