export interface ICDN {
  createDistribution(originId: string, bucketName: string, certificateArn?: string): Promise<string>;
  updateDistribution(id: string, config: any): Promise<void>;
  deleteDistribution(id: string): Promise<void>;
  // Add other relevant CDN operations
} 