export interface ICertManager {
  requestCertificate(domainName: string, alternativeNames?: string[]): Promise<string>; // Returns Certificate ARN
  getCertificateStatus(certificateArn: string): Promise<string>;
  deleteCertificate(certificateArn: string): Promise<void>;
  // Add other relevant certificate operations
} 