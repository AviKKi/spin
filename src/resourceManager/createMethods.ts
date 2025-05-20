import {
  S3Client,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  PutBucketWebsiteCommand,
  PutBucketTaggingCommand,
  waitUntilBucketExists,
  PutPublicAccessBlockCommand,
} from "@aws-sdk/client-s3";
import {
  ACMClient,
  RequestCertificateCommand,
  DescribeCertificateCommand,
  waitUntilCertificateValidated,
} from "@aws-sdk/client-acm";
import {
  CloudFrontClient,
  CreateDistributionCommand,
  TagResourceCommand as CfTagResourceCommand,
  waitUntilDistributionDeployed,
} from "@aws-sdk/client-cloudfront";
import {
  Route53Client,
  ListHostedZonesByNameCommand,
  ChangeResourceRecordSetsCommand,
  waitUntilResourceRecordSetsChanged,
} from "@aws-sdk/client-route-53";
import {
  DynamoDBClient,
  CreateTableCommand,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";

// Use us-east-1 for ACM & CloudFront
const REGION = "us-east-1";
const TAGS = [{ Key: "spi-cli", Value: "true" }];

// Validate domain name format
function validateDomainName(domainName: string): boolean {
  const domainRegex = /^(\*\.)?(((?!-)[A-Za-z0-9-]{0,62}[A-Za-z0-9])\.)+((?!-)[A-Za-z0-9-]{1,62}[A-Za-z0-9])$/;
  return domainRegex.test(domainName);
}

// Initialize AWS SDK v3 clients
const acmClient = new ACMClient({ region: REGION });
const cfClient = new CloudFrontClient({ region: REGION });
// const route53Client = new Route53Client({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });

// 1. Create and wait for S3 bucket readiness
async function createBucket(bucketName: string, region: string) {
  const s3Client = new S3Client({ region });
  await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
  console.log(`Bucket creation requested: ${bucketName}`);

  // Wait until the bucket exists
  await waitUntilBucketExists(
    { client: s3Client, maxWaitTime: 30 },
    { Bucket: bucketName }
  );
  console.log(`Bucket ready: ${bucketName}`);

  // Disable public access blocks
  await s3Client.send(
    new PutPublicAccessBlockCommand({
      Bucket: bucketName,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: false,
        BlockPublicPolicy: false,
        IgnorePublicAcls: false,
        RestrictPublicBuckets: false,
      },
    })
  );
  console.log(`Public access blocks disabled.`);

  // Wait for settings to propagate (AWS recommends waiting a few seconds)
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Apply public-read policy with retries
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicReadGetObject",
        Effect: "Allow",
        Principal: "*",
        Action: "s3:GetObject",
        Resource: `arn:aws:s3:::${bucketName}/*`,
      },
    ],
  };

  let retries = 3;
  while (retries > 0) {
    try {
      await s3Client.send(
        new PutBucketPolicyCommand({
          Bucket: bucketName,
          Policy: JSON.stringify(policy),
        })
      );
      console.log(`Bucket policy applied.`);
      break;
    } catch (error: any) {
      retries--;
      if (retries === 0) {
        throw new Error(`Failed to apply bucket policy after multiple attempts: ${error.message}`);
      }
      console.log(`Retrying bucket policy application... (${retries} attempts remaining)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Configure website hosting
  await s3Client.send(
    new PutBucketWebsiteCommand({
      Bucket: bucketName,
      WebsiteConfiguration: {
        IndexDocument: { Suffix: "index.html" },
        ErrorDocument: { Key: "error.html" },
      },
    })
  );
  console.log(`Website hosting configured.`);

  // Tag the bucket
  await s3Client.send(
    new PutBucketTaggingCommand({
      Bucket: bucketName,
      Tagging: { TagSet: TAGS },
    })
  );
  console.log(`Bucket tagged with spi-cli=true.`);
}

// Retrieve hosted zone ID
async function getHostedZoneId(
  rootDomain: string,
  region: string
): Promise<string> {
  const route53Client = new Route53Client({ region });
  const { HostedZones } = await route53Client.send(
    new ListHostedZonesByNameCommand({ DNSName: rootDomain, MaxItems: 1 })
  );
  if (!HostedZones || HostedZones.length === 0) {
    throw new Error(`Hosted zone for ${rootDomain} not found`);
  }
  return HostedZones[0].Id!.split("/")[2];
}

// Request and wait for ACM certificate issuance
async function requestCertificate(
  domainName: string,
  hostedZoneId: string,
  region: string
): Promise<string> {
  if (!validateDomainName(domainName)) {
    throw new Error(`Invalid domain name format: ${domainName}. Domain name must follow AWS ACM requirements.`);
  }
  
  const acmClient = new ACMClient({ region });
  const route53Client = new Route53Client({ region });
  const { CertificateArn } = await acmClient.send(
    new RequestCertificateCommand({
      DomainName: domainName,
      ValidationMethod: "DNS",
      Tags: TAGS,
    })
  );
  if (!CertificateArn) throw new Error("RequestCertificate failed");
  console.log(`Certificate requested: ${CertificateArn}`);

  // Describe until DNS validation options appear
  let options;
  do {
    const { Certificate } = await acmClient.send(
      new DescribeCertificateCommand({ CertificateArn })
    );
    options = Certificate?.DomainValidationOptions;
    if (!options) await new Promise((r) => setTimeout(r, 5000));
  } while (!options);

  // UPSERT DNS records for validation
  for (const opt of options) {
    const rec = opt.ResourceRecord!;
    await route53Client.send(
      new ChangeResourceRecordSetsCommand({
        HostedZoneId: hostedZoneId,
        ChangeBatch: {
          Changes: [
            {
              Action: "UPSERT",
              ResourceRecordSet: {
                Name: rec.Name,
                Type: rec.Type,
                TTL: 300,
                ResourceRecords: [{ Value: rec.Value }],
              },
            },
          ],
        },
      })
    );
    console.log(`Validation record created: ${rec.Name}`);
  }

  // Wait until certificate is ISSUED
  await waitUntilCertificateValidated(
    { client: acmClient, maxWaitTime: 300 },
    { CertificateArn }
  );
  console.log(`Certificate issued: ${CertificateArn}`);
  return CertificateArn;
}

// Create and wait for CloudFront distribution, then tag it
async function createCloudFrontDistribution(
  bucketName: string,
  domainName: string,
  certificateArn: string,
  region: string
) {
  const cfClient = new CloudFrontClient({ region });
  const originId = `S3-${bucketName}`;
  const params = {
    DistributionConfig: {
      CallerReference: `${Date.now()}`,
      Comment: `Distribution for ${domainName}`,
      Aliases: { Quantity: 1, Items: [domainName] },
      DefaultRootObject: "index.html",
      Origins: {
        Quantity: 1,
        Items: [
          {
            Id: originId,
            DomainName: `${bucketName}.s3.amazonaws.com`,
            CustomOriginConfig: {
              HTTPPort: 80,
              HTTPSPort: 443,
              OriginProtocolPolicy: "https-only" as const,
            },
          },
        ],
      },
      DefaultCacheBehavior: {
        TargetOriginId: originId,
        ViewerProtocolPolicy: "redirect-to-https" as const,
        ForwardedValues: {
          QueryString: false,
          Cookies: { Forward: "none" as const },
        },
        TrustedSigners: {
          Enabled: false,
          Quantity: 0,
        },
        MinTTL: 0,
        DefaultTTL: 86400,
        MaxTTL: 31536000,
        Compress: true,
      },
      ViewerCertificate: {
        ACMCertificateArn: certificateArn,
        SSLSupportMethod: "sni-only" as const,
        MinimumProtocolVersion: "TLSv1.2_2021" as const,
      },
      Enabled: true,
    },
  };
  const { Distribution } = await cfClient.send(
    new CreateDistributionCommand({ ...params })
  );
  if (!Distribution) throw new Error("CreateDistribution failed");
  console.log(`Distribution requested: ${Distribution.Id}`);

  // Wait until deployed
  await waitUntilDistributionDeployed(
    { client: cfClient, maxWaitTime: 600*20 },
    { Id: Distribution.Id! }
  );
  console.log(`Distribution deployed: ${Distribution.DomainName}`);

  // Tag the distribution
  await cfClient.send(
    new CfTagResourceCommand({
      Resource: Distribution.ARN!,
      Tags: { Items: TAGS },
    })
  );
  console.log(`CloudFront distribution tagged.`);

  return Distribution.DomainName!;
}

// UPSERT Route53 alias and wait for propagation
async function createRoute53Record(
  hostedZoneId: string,
  recordName: string,
  targetDomain: string,
  region: string
) {
  const route53Client = new Route53Client({ region });
  const { ChangeInfo } = await route53Client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: hostedZoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: recordName,
              Type: "A",
              AliasTarget: {
                HostedZoneId: "Z2FDTNDATAQYW2",
                DNSName: targetDomain,
                EvaluateTargetHealth: false,
              },
            },
          },
        ],
      },
    })
  );
  console.log(`Record change requested: ${ChangeInfo?.Id}`);

  // Wait for change to INSYNC
  await waitUntilResourceRecordSetsChanged(
    { client: route53Client, maxWaitTime: 60 },
    { Id: ChangeInfo?.Id! }
  );
  console.log(`Route53 record propagated: ${recordName}`);
}

export {
  createBucket,
  getHostedZoneId,
  requestCertificate,
  createCloudFrontDistribution,
  createRoute53Record,
};
