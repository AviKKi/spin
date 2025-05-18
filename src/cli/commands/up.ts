import { Command } from 'commander';
import chalk from 'chalk';
import Enquirer from 'enquirer';
import { discoverSpinAccounts } from '../dynamodb.js';
import { spawn } from 'child_process';
import { checkAWSIdentity } from '../utils/aws.js';

export function upCommand(program: Command) {
  program
    .command('up')
    .description('Deploy your Spin project')
    .option('-p, --profile <profile>', 'AWS profile to use')
    .option('-r, --region <region>', 'AWS region to use', 'us-east-1')
    .option('-y, --yes', 'Skip confirmations')
    .action(async (options) => {
      try {
        

    
      } catch (error) {
        console.error(chalk.red('Error:'), error);
        process.exit(1);
      }
    });
} 