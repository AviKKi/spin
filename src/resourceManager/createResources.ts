import { Account } from "../models/index.js";

import { Project } from "../models/index.js";

/** Given a project and account, create resources for SPA on AWS
 * save those resources in state
 * in case of exception prevent stale state
 */
async function createResources(project: Project, account: Account, environment: string){
    // create resources for SPA on AWS
    // save those resources in state
    // in case of exception prevent stale state
}