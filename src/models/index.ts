/**
 * Central data model definitions for the Spin application
 */

// ----- Entity Interfaces -----

/**
 * Account entity representing both config and database fields
 */
export interface Account {
  // DynamoDB keys
  pk: "ACCOUNT";
  sk: "METADATA";
  itemType: "ACCOUNT";
  
  // Business fields
  id?: string;
  name: string;
  tableName: string;
  defaultRegion: string;
  createdAt: string;
}

/**
 * Project entity representing both config and database fields
 */
export interface Project {
  // DynamoDB keys
  pk: `PROJECT#${string}`;
  sk: "METADATA";
  itemType: "PROJECT";
  
  // Business fields
  projectId: string;
  projectName: string;
  region: string;
  account: string;
  status: string;
  createdAt: string;
}



  

/**
 * Deployment entity
 */
export interface Deployment {
  // DynamoDB keys
  pk: `PROJECT#${string}`;
  sk: `DEPLOY#${string}`;
  itemType: "DEPLOYMENT";
  
  // Business fields
  projectId: string;
  createdAt: string;
  status: string;
  completedAt?: string;
}

/**
 * Alias entity
 */
export interface Alias {
  // DynamoDB keys
  pk: `PROJECT#${string}`;
  sk: `ALIAS#${string}`;
  itemType: "ALIAS";
  
  // Business fields
  projectId: string;
  aliasDomain: string;
  destDeploySK: string;
  status: string;
  createdAt: string;
}

/**
 * Resource entity
 */
export interface Resource {
  // DynamoDB keys
  pk: `PROJECT#${string}`;
  sk: "RESOURCE#staticAssets";
  itemType: "RESOURCE";
  
  // Business fields
  projectId: string;
  buckets: string[];
  certs: string[];
  cloudfrontId: string;
  createdAt: string;
}

/**
 * Global configuration
 */
export interface GlobalConfig {
  accounts: Account[];
  defaultAccount?: string;
}
