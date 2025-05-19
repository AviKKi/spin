import { Route53Client, ListHostedZonesCommand } from "@aws-sdk/client-route-53";

async function getAllDomains(region: string): Promise<string[]> {
    const client = new Route53Client({ region });
    const command = new ListHostedZonesCommand({});
    const response = await client.send(command);
    return response.HostedZones?.map((zone) => zone.Name ?? "") ?? [];
}

export { getAllDomains };
