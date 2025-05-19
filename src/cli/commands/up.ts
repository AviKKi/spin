import { Command } from "commander";
import chalk from "chalk";
import Enquirer from "enquirer";
import { discoverSpinAccounts } from "../dynamodb.js";
import { spawn } from "child_process";
import { checkAWSIdentity } from "../utils/aws.js";
import { loadGlobalConfig, loadProjectConfig, projectConfigExists } from "../config.js";
import { createRepositories } from "../../repositories/index.js";
import { createResources } from "../../resourceManager/createResources.js";

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
        if(!projectConfig.resources){
          // create resources for this project
          await createResources(projectConfig);
        }
        // run build command
        const buildCommand = projectConfig.buildCommand;
        const buildDirectory = projectConfig.buildDirectory;
        const buildProcess = spawn(buildCommand, { cwd: buildDirectory });
        buildProcess.stdout.on('data', (data) => {
          console.log(data.toString());
        });

        // copy files to s3 bucket
        // invalidate cloudfront distribution
        

      } catch (error) {
        console.error(chalk.red("Error:"), error);
        process.exit(1);
      }
    });
}
