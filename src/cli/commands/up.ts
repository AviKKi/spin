import { Command } from "commander";
import chalk from "chalk";
import Enquirer from "enquirer";
import { discoverSpinAccounts } from "../dynamodb.js";
import { spawn } from "child_process";
import { checkAWSIdentity } from "../utils/aws.js";
import {
  loadGlobalConfig,
  loadProjectConfig,
  projectConfigExists,
  saveProjectConfig,
} from "../config.js";
import { createRepositories } from "../../repositories/index.js";
import { createResources } from "../../resourceManager/createResources.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { readdir, readFile } from "fs/promises";
import { join } from "path";


// Recursively upload all files from build directory
async function uploadDirectory(dirPath: string, prefix = "", bucketName: string, region: string) {
  const s3Client = new S3Client({ region });
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    const key = prefix ? `${prefix}/${entry.name}` : entry.name;
    
    if (entry.isDirectory()) {
      await uploadDirectory(fullPath, key, bucketName, region);
    } else {
      const fileContent = await readFile(fullPath);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: fileContent,
          ContentType: getContentType(entry.name),
        })
      );
      console.log(chalk.green(`Uploaded: ${key}`));
    }
  }
}

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
        // if(!projectConfig.resources){
        // create resources for this project
        await createResources(
          projectConfig,
          async (updatedProject) => {
            await saveProjectConfig(updatedProject);
            console.log(chalk.green("Project config updated successfully"));
          },
          (message) => {
            console.log(chalk.blue(message));
          }
        );
        // }

        // run build command
        const [buildCommand, ...buildArgs] =
          projectConfig.buildCommand.split(" ");
        const buildProcess = spawn(buildCommand, buildArgs);
        buildProcess.stdout.on("data", (data) => {
          console.log(data.toString());
        });

        // Wait for build process to complete
        await new Promise((resolve, reject) => {
          buildProcess.on("close", (code) => {
            if (code === 0) {
              resolve(true);
            } else {
              reject(new Error(`Build process exited with code ${code}`));
            }
          });
        });

        // Upload files to S3
        console.log(chalk.blue("Uploading files to S3..."));
        
        const bucketName = projectConfig.resources?.buckets[0];
        
        if (!bucketName) {
          throw new Error("No S3 bucket found in project resources");
        }

        

        await uploadDirectory(projectConfig.buildDirectory, "", bucketName, projectConfig.region);

        // Invalidate CloudFront cache
        console.log(chalk.blue("Invalidating CloudFront cache..."));
        const cfClient = new CloudFrontClient({ region: projectConfig.region });
        const distributionId = projectConfig.resources?.cloudfrontId;
        
        if (!distributionId) {
          throw new Error("No CloudFront distribution found in project resources");
        }

        await cfClient.send(
          new CreateInvalidationCommand({
            DistributionId: distributionId,
            InvalidationBatch: {
              CallerReference: `${Date.now()}`,
              Paths: {
                Quantity: 1,
                Items: ["/*"],
              },
            },
          })
        );

        console.log(chalk.green("Deployment completed successfully!"));
      } catch (error) {
        console.error(chalk.red("Error:"), error);
        process.exit(1);
      }
    });
}

// Helper function to determine content type based on file extension
function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const contentTypes: { [key: string]: string } = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    txt: "text/plain",
    xml: "application/xml",
    pdf: "application/pdf",
  };
  return contentTypes[ext || ""] || "application/octet-stream";
}
