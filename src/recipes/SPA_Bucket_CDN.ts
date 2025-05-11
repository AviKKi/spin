import { IRecipe } from '../interfaces/IRecipe';
import { RecipeContext } from '../engine/RecipeEngine';
import { S3BucketProvider } from '../providers/aws/S3Bucket';
import { CloudFrontProvider } from '../providers/aws/CloudFront';
import { ACMProvider } from '../providers/aws/ACM';
import { Route53Provider } from '../providers/aws/Route53';

export class SpaBucketCdnRecipe implements IRecipe {
  name = 'SPA_Bucket_CDN';
  description = 'Deploys a Single Page Application to AWS S3 with CloudFront CDN, ACM SSL, and Route53 DNS.';

  async execute(context: RecipeContext): Promise<void> {
    console.log(`Executing ${this.name} recipe with context:`, context);

    const { providerConfig, deploymentConfig } = this.extractConfigs(context);

    // Initialize AWS service providers
    const s3Provider = new S3BucketProvider(providerConfig.region);
    const cfProvider = new CloudFrontProvider(providerConfig.region);
    const acmProvider = new ACMProvider('us-east-1'); // ACM for CloudFront must be in us-east-1
    const r53Provider = new Route53Provider(providerConfig.region);

    try {
      // 1. Create/configure S3 Bucket
      const bucketName = deploymentConfig.bucketName || `spin-spa-${Date.now()}`;
      console.log(`Ensuring S3 bucket ${bucketName} exists...`);
      await s3Provider.createBucket(bucketName, providerConfig.region);
      // TODO: Configure bucket for static website hosting, public access (if needed) & policies
      console.log('S3 Bucket setup complete.');

      // 2. Request ACM Certificate (if domain and autoCert is specified)
      let certificateArn: string | undefined;
      if (deploymentConfig.domain && deploymentConfig.autoCert) {
        console.log(`Requesting SSL certificate for ${deploymentConfig.domain}...`);
        certificateArn = await acmProvider.requestCertificate(deploymentConfig.domain);
        // TODO: Implement polling for certificate validation (DNS validation typically)
        console.log(`Certificate requested: ${certificateArn}. Manual DNS validation might be required.`);
      }

      // 3. Create CloudFront Distribution
      const bucketDomainName = `${bucketName}.s3.amazonaws.com`; // Or s3-website endpoint
      console.log(`Creating CloudFront distribution for origin ${bucketDomainName}...`);
      const distributionId = await cfProvider.createDistribution(
        `s3-${bucketName}`,
        bucketDomainName,
        certificateArn
      );
      console.log(`CloudFront distribution created: ${distributionId}`);
      // TODO: Get CloudFront domain name from distribution details
      const cfDomainName = 'd123example.cloudfront.net'; // Placeholder

      // 4. Configure DNS (if domain is specified)
      if (deploymentConfig.domain && deploymentConfig.useRoute53) {
        console.log(`Configuring Route53 DNS for ${deploymentConfig.domain} to point to ${cfDomainName}...`);
        // TODO: Find appropriate hosted zone ID for the domain
        const hostedZoneId = 'YOUR_HOSTED_ZONE_ID'; // Placeholder
        await r53Provider.createDnsRecord(
          hostedZoneId,
          deploymentConfig.domain,
          'A',
          cfDomainName, // Alias target for CloudFront is special
          // For Alias records, you don't specify TTL. Instead, you use AliasTarget properties.
        );
        console.log('DNS configuration complete.');
      }

      console.log('Deployment successful!');
      console.log(`  Bucket: ${bucketName}`);
      console.log(`  CloudFront ID: ${distributionId}`);
      console.log(`  CloudFront Domain: ${cfDomainName}`);
      if (deploymentConfig.domain) {
        console.log(`  Custom Domain: https://${deploymentConfig.domain}`);
      }

    } catch (error) {
      console.error(`${this.name} recipe failed:`, error);
      // TODO: Implement rollback steps if necessary
      throw error;
    }
  }

  private extractConfigs(context: RecipeContext): { providerConfig: any, deploymentConfig: any } {
    // TODO: Extract and validate necessary configurations from context.config
    // (e.g., from .spinrc or CLI flags)
    return {
      providerConfig: {
        region: context.config?.aws?.region || 'us-east-1',
      },
      deploymentConfig: {
        bucketName: context.config?.aws?.bucketName,
        domain: context.config?.domains?.[0], // Assuming first domain is primary
        autoCert: context.config?.aws?.autoCert !== undefined ? context.config.aws.autoCert : true,
        useRoute53: context.config?.aws?.useRoute53 !== undefined ? context.config.aws.useRoute53 : true,
        // ... other deployment specific settings
      }
    };
  }
} 