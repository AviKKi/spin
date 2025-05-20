import {
  S3Client,
  DeleteBucketCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  ACMClient,
  DeleteCertificateCommand,
} from "@aws-sdk/client-acm";
import {
  CloudFrontClient,
  DeleteDistributionCommand,
  GetDistributionConfigCommand,
  waitUntilDistributionDeployed,
} from "@aws-sdk/client-cloudfront";
import {
  Route53Client,
  ChangeResourceRecordSetsCommand,
  waitUntilResourceRecordSetsChanged,
} from "@aws-sdk/client-route-53";

// Use us-east-1 for ACM & CloudFront
const REGION = "us-east-1";

// Initialize AWS SDK v3 clients
const acmClient = new ACMClient({ region: REGION });
const cfClient = new CloudFrontClient({ region: REGION });
const route53Client = new Route53Client({ region: REGION });

// Delete S3 bucket and its contents
async function deleteBucket(bucketName: string, region: string) {
  const s3Client = new S3Client({ region });
  
  // List and delete all objects in the bucket
  const listCommand = new ListObjectsV2Command({ Bucket: bucketName });
  const listedObjects = await s3Client.send(listCommand);
  
  if (listedObjects.Contents) {
    const deletePromises = listedObjects.Contents.map(({ Key }) =>
      s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key }))
    );
    await Promise.all(deletePromises);
  }

  // Delete the bucket
  await s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
  console.log(`Bucket deleted: ${bucketName}`);
}

// Delete ACM certificate
async function deleteCertificate(certificateArn: string) {
  await acmClient.send(new DeleteCertificateCommand({ CertificateArn: certificateArn }));
  console.log(`Certificate deleted: ${certificateArn}`);
}

// Delete CloudFront distribution
async function deleteDistribution(distributionId: string) {
  // Get the current distribution config
  const { DistributionConfig, ETag } = await cfClient.send(
    new GetDistributionConfigCommand({ Id: distributionId })
  );

  if (!DistributionConfig) {
    throw new Error("Failed to get distribution config");
  }

  // Disable the distribution first
  DistributionConfig.Enabled = false;
  await cfClient.send(
    new DeleteDistributionCommand({
      Id: distributionId,
      IfMatch: ETag,
    })
  );

  // Wait for the distribution to be disabled
  await waitUntilDistributionDeployed(
    { client: cfClient, maxWaitTime: 600 },
    { Id: distributionId }
  );
  console.log(`Distribution deleted: ${distributionId}`);
}

// Delete Route53 record
async function deleteRoute53Record(hostedZoneId: string, recordName: string, targetDomain: string) {
  const { ChangeInfo } = await route53Client.send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: hostedZoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: "DELETE",
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

  // Wait for the change to propagate
  await waitUntilResourceRecordSetsChanged(
    { client: route53Client, maxWaitTime: 60 },
    { Id: ChangeInfo?.Id! }
  );
  console.log(`Route53 record deleted: ${recordName}`);
}

export {
  deleteBucket,
  deleteCertificate,
  deleteDistribution,
  deleteRoute53Record,
}; 