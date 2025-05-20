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

// Validate domain name format
function validateDomainName(domainName: string): boolean {
  const domainRegex = /^(\*\.)?(((?!-)[A-Za-z0-9-]{0,62}[A-Za-z0-9])\.)+((?!-)[A-Za-z0-9-]{1,62}[A-Za-z0-9])$/;
  return domainRegex.test(domainName);
}

// Sanitize subdomain by removing invalid characters
function sanitizeSubdomain(subdomain: string): string {
  // Remove any characters that aren't letters, numbers, or hyphens
  let sanitized = subdomain.replace(/[^a-zA-Z0-9-]/g, '');
  // Remove leading and trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, '');
  // Replace multiple consecutive hyphens with a single hyphen
  sanitized = sanitized.replace(/-+/g, '-');
  return sanitized;
}

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
            }
        ]);

        // Handle subdomain input with validation and retry
        let subdomain = '';
        let isValid = false;
        while (!isValid) {
            const subdomainPrompt: { subdomain: string } = await Enquirer.prompt([
                {
                    type: 'input',
                    name: 'subdomain',
                    message: 'Enter the subdomain to use',
                    initial: subdomain || projectConfigInput.projectName + '.dev'
                }
            ]);
            
            const fullDomain = `${subdomainPrompt.subdomain}.${domainPrompt.domain}`;
            if (validateDomainName(fullDomain)) {
                subdomain = subdomainPrompt.subdomain;
                isValid = true;
            } else {
                console.log(chalk.red(`Invalid domain name format: ${fullDomain}`));
                console.log(chalk.yellow('Domain name must follow AWS ACM requirements:'));
                console.log(chalk.yellow('- Can only contain letters, numbers, and hyphens'));
                console.log(chalk.yellow('- Cannot start or end with a hyphen'));
                console.log(chalk.yellow('- Each part between dots must be 1-63 characters long'));
                
                // Sanitize the invalid subdomain for the next attempt
                subdomain = sanitizeSubdomain(subdomainPrompt.subdomain);
                console.log(chalk.blue(`Suggested valid subdomain: ${subdomain}`));
            }
        }

        saveProjectConfig({
            projectName: projectConfigInput.projectName,
            buildCommand: projectConfigInput.buildCommand,
            buildDirectory: projectConfigInput.buildDirectory,
            region: projectConfigInput.region,
            domain: domainPrompt.domain,
            subDomain: subdomain,
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