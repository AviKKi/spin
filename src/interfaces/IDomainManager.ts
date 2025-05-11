export interface IDomainManager {
  listHostedZones(): Promise<any[]>;
  createDnsRecord(zoneId: string, name: string, type: string, value: string, ttl?: number): Promise<void>;
  deleteDnsRecord(zoneId: string, name: string, type: string, value: string): Promise<void>;
  // Add other relevant DNS/domain operations
} 