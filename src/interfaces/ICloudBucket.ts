export interface ICloudBucket {
  createBucket(name: string, region: string): Promise<string>;
  uploadFile(bucketName: string, filePath: string, fileKey: string): Promise<void>;
  deleteBucket(name: string): Promise<void>;
  // Add other relevant bucket operations
} 