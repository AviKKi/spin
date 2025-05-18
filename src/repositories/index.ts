import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  Account,
  Project,
  Deployment,
  Alias,
  Resource
} from "../models/index.js";

// ----- Base Repository -----

class BaseRepository {
  protected client: DynamoDBDocumentClient;
  protected tableName: string;

  constructor(client: DynamoDBDocumentClient, tableName: string) {
    this.client = client;
    this.tableName = tableName;
  }
}

// ----- Account Repository -----

export class AccountRepository extends BaseRepository {
  /**
   * Retrieve the account metadata record.
   * @returns Promise resolving to the Account item or null if not found.
   */
  async getAccount(): Promise<Account | null> {
    const cmd = new GetCommand({
      TableName: this.tableName,
      Key: { pk: "ACCOUNT", sk: "METADATA" },
    });
    const { Item } = await this.client.send(cmd);
    return Item as Account | null;
  }

  /**
   * Save or overwrite the account metadata record.
   * @param account - Partial account data (excluding PK/SK/itemType).
   */
  async saveAccount(account: Omit<Account, "pk" | "sk" | "itemType">): Promise<void> {
    const item: Account = {
      pk: "ACCOUNT",
      sk: "METADATA",
      itemType: "ACCOUNT",
      ...account,
    };
    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: item })
    );
  }
}

// ----- Project Repository -----

export class ProjectRepository extends BaseRepository {
  /**
   * Create a new project metadata record.
   * @param project - Project data excluding PK/SK/itemType.
   */
  async createProject(project: Omit<Project, "pk" | "sk" | "itemType">): Promise<void> {
    const item: Project  = {
      pk: `PROJECT#${project.projectId}`,
      sk: "METADATA",
      itemType: "PROJECT",
      ...project,
    };
    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: item })
    );
  }

  /**
   * Retrieve a project record by its ID.
   * @param projectId - The unique project identifier.
   * @returns Promise resolving to the Project item or null if not found.
   */
  async getProject(projectId: string): Promise<Project | null> {
    const cmd = new GetCommand({
      TableName: this.tableName,
      Key: { pk: `PROJECT#${projectId}`, sk: "METADATA" },
    });
    const { Item } = await this.client.send(cmd);
    return Item as Project | null;
  }

  /**
   * List all projects across the account.
   * @returns Promise resolving to an array of Project items.
   */
  async listProjects(): Promise<Project[]> {
    const cmd = new QueryCommand({
      TableName: this.tableName,
      IndexName: "GSI-Projects",
      KeyConditionExpression: "itemType = :t",
      ExpressionAttributeValues: { ":t": "PROJECT" },
    });
    const { Items } = await this.client.send(cmd);
    return Items as Project[];
  }

  /**
   * Update the status field of a project.
   * @param projectId - The project ID to update.
   * @param status - New status string.
   */
  async updateProjectStatus(
    projectId: string,
    status: string
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `PROJECT#${projectId}`, sk: "METADATA" },
        UpdateExpression: "SET #st = :s",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":s": status },
      })
    );
  }
}

// ----- Deployment Repository -----

export class DeploymentRepository extends BaseRepository {
  /**
   * Create a new deployment record under a project.
   * @param deploy - Deployment data excluding PK/SK/itemType.
   */
  async createDeployment(deploy: Omit<Deployment, "pk" | "sk" | "itemType">): Promise<void> {
    const item: Deployment = {
      pk: `PROJECT#${deploy.projectId}`,
      sk: `DEPLOY#${deploy.createdAt}`,
      itemType: "DEPLOYMENT",
      ...deploy,
    };
    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: item })
    );
  }

  /**
   * List all deployments for a given project.
   * @param projectId - The project identifier.
   * @returns Promise resolving to an array of Deployment items.
   */
  async listDeployments(projectId: string): Promise<Deployment[]> {
    const cmd = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "pk = :p AND begins_with(sk, :d)",
      ExpressionAttributeValues: { ":p": `PROJECT#${projectId}`, ":d": "DEPLOY#" },
    });
    const { Items } = await this.client.send(cmd);
    return Items as Deployment[];
  }

  /**
   * Get the latest deployment record for a project.
   * @param projectId - The project identifier.
   * @returns Promise resolving to the latest Deployment or null.
   */
  async getLatestDeployment(projectId: string): Promise<Deployment | null> {
    const cmd = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "pk = :p AND begins_with(sk, :d)",
      ExpressionAttributeValues: { ":p": `PROJECT#${projectId}`, ":d": "DEPLOY#" },
      ScanIndexForward: false,
      Limit: 1,
    });
    const { Items } = await this.client.send(cmd);
    return (Items?.[0] as Deployment) || null;
  }

  /**
   * Update status (and optionally completedAt) of a deployment.
   * @param projectId - The project identifier.
   * @param createdAt - The deployment timestamp key.
   * @param status - New status value.
   * @param completedAt - Optional completion timestamp.
   */
  async updateDeploymentStatus(
    projectId: string,
    createdAt: string,
    status: string,
    completedAt?: string
  ): Promise<void> {
    const updateExp = ["SET #st = :s"];
    const exprNames: Record<string, string> = { "#st": "status" };
    const exprValues: Record<string, any> = { ":s": status };
    if (completedAt) {
      updateExp.push("#,ca = :c");
      exprNames["#,ca"] = "completedAt";
      exprValues[":c"] = completedAt;
    }

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `PROJECT#${projectId}`, sk: `DEPLOY#${createdAt}` },
        UpdateExpression: updateExp.join(", "),
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
      })
    );
  }
}

// ----- Alias Repository -----

export class AliasRepository extends BaseRepository {
  /**
   * Create a new alias mapping for a project.
   * @param alias - Alias data excluding PK/SK/itemType.
   */
  async createAlias(alias: Omit<Alias, "pk" | "sk" | "itemType">): Promise<void> {
    const item: Alias = {
      pk: `PROJECT#${alias.projectId}`,
      sk: `ALIAS#${alias.aliasDomain}`,
      itemType: "ALIAS",
      ...alias,
    };
    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: item })
    );
  }

  /**
   * List all alias records for a project.
   * @param projectId - The project identifier.
   * @returns Promise resolving to an array of Alias items.
   */
  async listAliases(projectId: string): Promise<Alias[]> {
    const cmd = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "pk = :p AND begins_with(sk, :a)",
      ExpressionAttributeValues: { ":p": `PROJECT#${projectId}`, ":a": "ALIAS#" },
    });
    const { Items } = await this.client.send(cmd);
    return Items as Alias[];
  }

  /**
   * Retrieve an alias by its domain name.
   * @param domain - The alias domain string.
   * @returns Promise resolving to the Alias item or null.
   */
  async getAliasByDomain(domain: string): Promise<Alias | null> {
    const cmd = new QueryCommand({
      TableName: this.tableName,
      IndexName: "GSI-DomainLookup",
      KeyConditionExpression: "aliasDomain = :d",
      ExpressionAttributeValues: { ":d": domain },
    });
    const { Items } = await this.client.send(cmd);
    return (Items?.[0] as Alias) || null;
  }

  /**
   * Update status and destination deployment key for an alias.
   * @param projectId - The project identifier.
   * @param domain - Alias domain string.
   * @param status - New status value.
   * @param destDeploySK - Sort key of the target deployment.
   */
  async updateAliasStatus(
    projectId: string,
    domain: string,
    status: string,
    destDeploySK: string
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: `PROJECT#${projectId}`,
          sk: `ALIAS#${domain}`,
        },
        UpdateExpression: "SET #st = :s, destDeploySK = :d",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":s": status, ":d": destDeploySK },
      })
    );
  }
}

// ----- Resource Repository -----

export class ResourceRepository extends BaseRepository {
  /**
   * Insert or update the static assets resource record for a project.
   * @param resource - Resource data excluding PK/SK/itemType.
   */
  async upsertResource(resource: Omit<Resource, "pk" | "sk" | "itemType">): Promise<void> {
    const item: Resource = {
      pk: `PROJECT#${resource.projectId}`,
      sk: `RESOURCES#${resource.environment}`,
      itemType: "RESOURCE",
      ...resource,
    };
    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: item })
    );
  }

  /**
   * Retrieve the static assets resource record for a project.
   * @param projectId - The project identifier.
   * @returns Promise resolving to the Resource item or null.
   */
  async getResource(projectId: string, environment: string): Promise<Resource | null> {
    const cmd = new GetCommand({
      TableName: this.tableName,
      Key: { pk: `PROJECT#${projectId}`, sk: `RESOURCE#${environment}` },
    });
    const { Item } = await this.client.send(cmd);
    return Item as Resource | null;
  }
}

// ----- Client Initialization -----

/**
 * Initialize all DynamoDB repositories for the given table.
 * @param region - AWS region of the DynamoDB table.
 * @param tableName - Name of the DynamoDB table.
 * @returns An object containing all repository instances.
 */
export function createRepositories(
  region: string,
  tableName: string
) {
  const client = new DynamoDBClient({ region });
  const docClient = DynamoDBDocumentClient.from(client);

  return {
    accountRepo: new AccountRepository(docClient, tableName),
    projectRepo: new ProjectRepository(docClient, tableName),
    deploymentRepo: new DeploymentRepository(docClient, tableName),
    aliasRepo: new AliasRepository(docClient, tableName),
    resourceRepo: new ResourceRepository(docClient, tableName),
  };
}
