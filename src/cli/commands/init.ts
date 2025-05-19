import { Command } from 'commander';
import chalk from 'chalk';
import { DynamoDBClient, CreateTableCommand, TagResourceCommand } from '@aws-sdk/client-dynamodb';
import { fromIni } from '@aws-sdk/credential-providers';
import { loadGlobalConfig, projectConfigExists, saveProjectConfig } from '../config.js';
import { Account, Project } from '../../models/index.js';
import { checkAWSIdentity } from '../utils/aws.js';
import Enquirer from 'enquirer';
import { createNewAccount } from '../accountHandler.js';
import { randomUUID } from 'crypto';
import { getAllDomains } from '../utils/route53.js';

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
        const projectConfigInput: {projectName: string, buildCommand: string, buildDirectory: string, region: string} = await Enquirer.prompt([
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
                initial: 'us-east-1'
            },
        ]);
        
        const domains = await getAllDomains(projectConfigInput.region as string);
        const domainPrompt: {domain: string, subdomain: string} = await Enquirer.prompt([
            {
                type: 'select',
                name: 'domain',
                message: 'Select the domain to use',
                choices: domains.map((domain) => ({ name: domain, value: domain })),
            },
            {
                type: 'input',
                name: 'subdomain',
                message: 'Enter the subdomain to use',
                initial: projectConfigInput.projectName + '.dev'
            }
        ]);
        saveProjectConfig({
            projectName: projectConfigInput.projectName,
            buildCommand: projectConfigInput.buildCommand,
            buildDirectory: projectConfigInput.buildDirectory,
            region: projectConfigInput.region,
            domain: domainPrompt.domain,
            subDomain: domainPrompt.subdomain,
            projectId: randomUUID(),
            pk: `PROJECT#${projectConfigInput.projectName}`,
            sk: 'METADATA',
            itemType: 'PROJECT',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            account: 'default',
            environments: [],
        });
    });
} 