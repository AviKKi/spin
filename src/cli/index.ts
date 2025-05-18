#!/usr/bin/env node

import { Command } from 'commander';
// import { upCommand } from './commands/up.js';
import { initCommand } from './commands/init.js';
import { checkAWSIdentity } from './utils/aws.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('spin')
  .description('CLI tool for managing Spin accounts and deployments')
  .version('1.0.0')
  .hook('preSubcommand', async (thisCommand, actionCommand) => {
    // Check AWS identity first
    const identity = await checkAWSIdentity();
    console.log(chalk.blue(`Using AWS account: ${identity.account}`));
  });

// Register commands
// upCommand(program);
initCommand(program);

program.parse(); 
