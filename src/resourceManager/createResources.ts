import { Account } from "../models/index.js";
import { Project, Resource } from "../models/index.js";
import {
  createBucket,
  getHostedZoneId,
  requestCertificate,
  createCloudFrontDistribution,
  createRoute53Record,
} from "./createMethods.js";
import {
  deleteBucket,
  deleteCertificate,
  deleteDistribution,
  deleteRoute53Record,
} from "./deleteMethods.js";

const TAGS = [{ Key: 'spi-cli', Value: 'true' }];

/** Given a project and account, create resources for SPA on AWS
 * save those resources in state
 * in case of exception prevent stale state
 */
async function createResources(project: Project, callback?: (message: string) => void) {
    try {
        // Extract required information from project
        const { domain, region = 'us-east-1' } = project;
        const bucketName = `${domain.replace(/\./g, '-')}-${Date.now()}`;

        // Step 1: Create S3 bucket
        callback?.('Creating S3 bucket...');
        await createBucket(bucketName, region);

        // Step 2: Get hosted zone ID
        callback?.('Getting hosted zone ID...');
        const hostedZoneId = await getHostedZoneId(domain, region);

        // Step 3: Request and validate SSL certificate
        callback?.('Requesting SSL certificate...');
        const certificateArn = await requestCertificate(domain, hostedZoneId, region);

        // Step 4: Create CloudFront distribution
        callback?.('Creating CloudFront distribution...');
        const distributionDomain = await createCloudFrontDistribution(
            bucketName,
            domain,
            certificateArn,
            region
        );

        // Step 5: Create Route53 record
        callback?.('Creating Route53 record...');
        await createRoute53Record(hostedZoneId, domain, distributionDomain, region);

        // Save the created resources in project state
        const resource: Resource = {
            pk: `PROJECT#${project.projectId}`,
            sk: `RESOURCES#${project.environments[0]?.name || 'main'}`,
            itemType: "RESOURCE",
            projectId: project.projectId,
            environment: project.environments[0]?.name || 'main',
            buckets: [bucketName],
            certs: [certificateArn],
            cloudfrontId: distributionDomain,
            createdAt: new Date().toISOString()
        };

        project.resources = resource;
        callback?.('Infrastructure creation completed successfully!');
        return project;
    } catch (error) {
        // In case of error, clean up any created resources
        if (project.resources) {
            await deleteResources(project, callback);
        }
        throw error;
    }
}

async function deleteResources(project: Project, callback?: (message: string) => void) {
    try {
        if (!project.resources) {
            callback?.('No resources to delete');
            return;
        }

        const { buckets, certs, cloudfrontId } = project.resources;
        const { domain, region = 'us-east-1' } = project;

        // Step 1: Delete Route53 record
        callback?.('Deleting Route53 record...');
        const hostedZoneId = await getHostedZoneId(domain, region);
        await deleteRoute53Record(hostedZoneId, domain, cloudfrontId);

        // Step 2: Delete CloudFront distribution
        callback?.('Deleting CloudFront distribution...');
        await deleteDistribution(cloudfrontId);

        // Step 3: Delete ACM certificate
        callback?.('Deleting SSL certificate...');
        for (const certArn of certs) {
            await deleteCertificate(certArn);
        }

        // Step 4: Delete S3 bucket
        callback?.('Deleting S3 bucket...');
        for (const bucketName of buckets) {
            await deleteBucket(bucketName, region);
        }

        // Clear resources from project state
        project.resources = undefined;
        callback?.('All resources deleted successfully!');
    } catch (error) {
        callback?.(`Error deleting resources: ${error}`);
        throw error;
    }
}

export { createResources, deleteResources };