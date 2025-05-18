import { Command } from 'commander';
import chalk from 'chalk';
import { DynamoDBClient, CreateTableCommand, TagResourceCommand } from '@aws-sdk/client-dynamodb';
import { fromIni } from '@aws-sdk/credential-providers';
import { createProjectConfig, loadGlobalConfig, projectConfigExists } from '../config.js';
import { Account, Project } from '../../models/index.js';
import { checkAWSIdentity } from '../utils/aws.js';
import Enquirer from 'enquirer';
import { createNewAccount } from '../accountHandler.js';
import { randomUUID } from 'crypto';

export function initCommand(program: Command) {
  program
    .command('init')
    .description('Initialize a new Spin account')
    .option('-p, --profile <profile>', 'AWS profile to use')
    .option('-r, --region <region>', 'AWS region to use', 'us-east-1')
    .option('-n, --name <n>', 'Name for the Spin account')
    .action(async (options) => {
        if(await projectConfigExists()){
            console.log(chalk.red('Project config already exists'));
            return;
        }
        const globalConfig = await loadGlobalConfig();
        // show enquirer list of account from global config, with last option to create new account
        const input = await Enquirer.prompt([
            {
                type: 'select',
                name: 'account',
                message: 'Select an account',
                choices: [...globalConfig.accounts.map(account => account.name), 'Create new account']
            }
        ]);
        let account: Account;
        if((input as any).account === 'Create new account'){
            const createProjectInput = await Enquirer.prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: 'Enter the name of the new account'
                }, 
                {
                    type: 'input',
                    name: 'region',
                    message: 'Enter the region of the new account',
                    initial: 'us-east-1'
                }
            ]);
            account = await createNewAccount({...(createProjectInput as any)});
        } else {
            const matchingAccount = globalConfig.accounts.find(account => account.name === (input as any).account);
            if(!matchingAccount){
                console.log(chalk.red('Account not found'));
                return;
            }
            account = matchingAccount;
        }
        // input project config, with following fields
        // projectName: string, default folder name
        // buildCommand: string, default npm run build
        // buildDirectory: string, default ./dist
        // region: string, default region
        const projectConfigInput = await Enquirer.prompt([
            {
                type: 'input',
                name: 'projectName',
                message: 'Enter the name of the project'
            },
            {
                type: 'input',
                name: 'buildCommand',
                message: 'Enter the build command',
                initial: 'npm run build'
            },
            {
                type: 'input',
                name: 'buildDirectory',
                message: 'Enter the build directory',
                initial: './dist'
            },
            {
                type: 'input',
                name: 'region',
                message: 'Enter the region of the project',
                initial: account.defaultRegion
            },
        ]);

        const projectId = randomUUID();
        const projectConfig: Project = {
            pk: `PROJECT#${projectId}`,
            sk: "METADATA",
            itemType: "PROJECT",
            projectId,
            status: "INITIALIZED",
            createdAt: new Date().toISOString(),
            ...(projectConfigInput as any),
            account: account.name,
            region: account.defaultRegion
        };

        await createProjectConfig(projectConfig, account.defaultRegion, account.tableName);
        console.log(chalk.green('Project config created successfully'));
    });
} 