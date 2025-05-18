import fs from "fs";
import path from "path";
import os from "os";
import { Account, GlobalConfig, Project } from "../models/index.js";
import { createRepositories } from "../repositories/index.js";

// File paths
const GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".spin");
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, "config.json");
const PROJECT_CONFIG_DIR = path.join(".spin");
const PROJECT_CONFIG_FILE = path.join(PROJECT_CONFIG_DIR, "config.json");

/** load global config from ~/.spin/config.json */
export async function loadGlobalConfig(): Promise<GlobalConfig> {
  try {
    if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
      fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
    }

    if (!fs.existsSync(GLOBAL_CONFIG_FILE)) {
      const initialConfig: GlobalConfig = { accounts: [] };
      await saveGlobalConfig(initialConfig);
      return initialConfig;
    }

    const configData = await fs.promises.readFile(GLOBAL_CONFIG_FILE, "utf-8");
    return JSON.parse(configData);
  } catch (error) {
    console.error("Error loading config:", error);
    return { accounts: [] };
  }
}

export async function projectConfigExists(): Promise<boolean> {
  return fs.existsSync(PROJECT_CONFIG_FILE);
}

export async function createProjectConfig(config: Project, region: string, tableName: string): Promise<void> {
  // Save locally
  if (!fs.existsSync(PROJECT_CONFIG_DIR)) {
    fs.mkdirSync(PROJECT_CONFIG_DIR, { recursive: true });
  }
  await fs.promises.writeFile(
    PROJECT_CONFIG_FILE,
    JSON.stringify(config, null, 2)
  );

  // Save to DynamoDB
  const { projectRepo } = createRepositories(region, tableName);
  await projectRepo.createProject(config);
}

export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  try {
    await fs.promises.writeFile(
      GLOBAL_CONFIG_FILE,
      JSON.stringify(config, null, 2)
    );
  } catch (error) {
    console.error("Error saving config:", error);
    throw error;
  }
}
