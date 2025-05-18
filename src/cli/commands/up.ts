import { Command } from "commander";
import chalk from "chalk";
import Enquirer from "enquirer";
import { discoverSpinAccounts } from "../dynamodb.js";
import { spawn } from "child_process";
import { checkAWSIdentity } from "../utils/aws.js";
import { loadGlobalConfig, loadProjectConfig, projectConfigExists } from "../config.js";
import { createRepositories } from "../../repositories/index.js";

export function upCommand(program: Command) {
  program
    .command("up")
    .description("Deploy your Spin project")
    .argument("[environment]", "Environment to deploy to", "staging")
    .action(async (environment: string) => {
      try {
        if (!projectConfigExists()) {
          console.error(
            chalk.red("Project config not found, run `spin init` to create one")
          );
          process.exit(1);
        }
        const projectConfig = await loadProjectConfig();
        const globalConfig = await loadGlobalConfig();
        const account = globalConfig.accounts.find(
          (account) => account.name === projectConfig.account
        );
        if (!account) {
          console.error(chalk.red("Account not found"));
          process.exit(1);
        }
        console.log("deploying to environment", environment);

        const { resourceRepo } = createRepositories(account.defaultRegion, account.tableName);

        // check if resources exists for this project
        const resources = await resourceRepo.getResource(projectConfig.pk, "staging");
        // if not, create resources for default staging environment
        if(!resources){

        }

        // if exists continue with build and deploy

      } catch (error) {
        console.error(chalk.red("Error:"), error);
        process.exit(1);
      }
    });
}
