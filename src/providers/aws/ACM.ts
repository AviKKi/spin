import { ICertManager } from '../../interfaces/ICertManager';
import { ACMClient } from '@aws-sdk/client-acm';

export class ACMProvider implements ICertManager {
  private acm: ACMClient;

  constructor(region: string = 'us-east-1') { // ACM certificates for CloudFront must be in us-east-1
    this.acm = new ACMClient({ region });
  }

  async requestCertificate(domainName: string, alternativeNames?: string[]): Promise<string> {
    console.log(`Requesting ACM certificate for ${domainName}`);
    // TODO: Implement ACM certificate request
    // const params = { DomainName: domainName, ValidationMethod: 'DNS', SubjectAlternativeNames: alternativeNames };
    // const { CertificateArn } = await this.acm.requestCertificate(params).promise();
    // return CertificateArn;
    return 'cert-arn-placeholder';
  }

  async getCertificateStatus(certificateArn: string): Promise<string> {
    console.log(`Getting status for ACM certificate: ${certificateArn}`);
    // TODO: Implement ACM certificate status check
    return 'PENDING_VALIDATION';
  }

  async deleteCertificate(certificateArn: string): Promise<void> {
    console.log(`Deleting ACM certificate: ${certificateArn}`);
    // TODO: Implement ACM certificate deletion
  }
} 