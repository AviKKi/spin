#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { loadCommands } from '../src/cli/index';
// Potentially load package.json to get version dynamically
// import pkg from '../package.json'; 

const program = new Command();

program
  .version('0.1.0') // or pkg.version
  .description('Spin CLI - Deploy static and dynamic web applications');

loadCommands(program);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
} 