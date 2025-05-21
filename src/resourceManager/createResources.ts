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
async function createResources(
  project: Project, 
  updateProject?: (project: Project) => Promise<void>,
  callback?: (message: string) => void
) {
    try {
        // Extract required information from project
        const { domain, subDomain = '', region = 'us-east-1' } = project;
        const fullDomain = subDomain ? `${subDomain}.${domain}` : domain;
        const environment = project.environments[0]?.name || 'main';

        // Initialize or get existing resources
        let resource: Resource = project.resources || {
            pk: `PROJECT#${project.projectId}`,
            sk: `RESOURCES#${environment}`,
            itemType: "RESOURCE",
            projectId: project.projectId,
            environment: environment,
            buckets: [],
            certs: [],
            cloudfrontId: '',
            createdAt: new Date().toISOString()
        };

        // Step 1: Create S3 bucket if not exists
        let bucketName = resource.buckets[0];
        if (!bucketName) {
            callback?.('Creating S3 bucket...');
            bucketName = `${fullDomain.replace(/\./g, '-')}-${Date.now()}`;
            await createBucket(bucketName, region);
            resource.buckets = [bucketName];
            // Update project after bucket creation
            project.resources = resource;
            if (updateProject) await updateProject(project);
        } else {
            callback?.('S3 bucket already exists, skipping creation.');
        }

        // Step 2: Get hosted zone ID
        callback?.('Getting hosted zone ID...');
        const hostedZoneId = await getHostedZoneId(domain, region);

        // Step 3: Request and validate SSL certificate if not exists
        let certificateArn = resource.certs[0];
        if (!certificateArn) {
            callback?.('Requesting SSL certificate...');
            certificateArn = await requestCertificate(fullDomain, hostedZoneId, region);
            resource.certs = [certificateArn];
            // Update project after certificate creation
            project.resources = resource;
            if (updateProject) await updateProject(project);
        } else {
            callback?.('SSL certificate already exists, skipping creation.');
        }

        // Step 4: Create CloudFront distribution if not exists
        let distributionId = resource.cloudfrontId;
        if (!distributionId) {
            callback?.('Creating CloudFront distribution...');
            distributionId = await createCloudFrontDistribution(
                bucketName,
                fullDomain,
                certificateArn,
                region
            );
            resource.cloudfrontId = distributionId;
            // Update project after distribution creation
            project.resources = resource;
            if (updateProject) await updateProject(project);
        } else {
            callback?.('CloudFront distribution already exists, skipping creation.');
        }

        // Step 5: Create Route53 record if not exists
        // Note: We can't easily check if Route53 record exists, so we'll always try to create/update it
        callback?.('Creating/Updating Route53 record...');
        await createRoute53Record(hostedZoneId, fullDomain, `${distributionId}.cloudfront.net`, region);

        callback?.('Infrastructure creation completed successfully!');
        return project;
    } catch (error) {
        // In case of error, clean up any created resources
        
        throw error;
    }
}

async function deleteResources(
    project: Project, 
    updateProject?: (project: Project) => Promise<void>,
    callback?: (message: string) => void
) {
    try {
        if (!project.resources) {
            callback?.('No resources to delete');
            return;
        }

        const { buckets, certs, cloudfrontId } = project.resources;
        const { domain, subDomain = '', region = 'us-east-1' } = project;
        const fullDomain = subDomain ? `${subDomain}.${domain}` : domain;

        // Step 1: Delete Route53 record
        callback?.('Deleting Route53 record...');
        const hostedZoneId = await getHostedZoneId(domain, region);
        await deleteRoute53Record(hostedZoneId, fullDomain, cloudfrontId);

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
        if (updateProject) await updateProject(project);
        callback?.('All resources deleted successfully!');
    } catch (error) {
        callback?.(`Error deleting resources: ${error}`);
        throw error;
    }
}

export { createResources, deleteResources };