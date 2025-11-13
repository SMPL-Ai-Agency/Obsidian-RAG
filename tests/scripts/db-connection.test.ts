import {
        buildConnectionDetails,
        buildConnectionDetailsFromEnv,
        buildPoolerHost,
        inferRegionFromSupabaseUrl
} from '../../scripts/db-connection';

describe('inferRegionFromSupabaseUrl', () => {
        it('extracts the AWS region prefix when present in the host', () => {
                const region = inferRegionFromSupabaseUrl('https://aws-0-ap-southeast-1.supabase.co');
                expect(region).toBe('ap-southeast-1');
        });

        it('returns null when the URL does not encode the region', () => {
                const region = inferRegionFromSupabaseUrl('https://project-ref.supabase.co');
                expect(region).toBeNull();
        });
});

describe('buildConnectionDetails', () => {
        it('prefers an explicit host override', () => {
                const details = buildConnectionDetails({
                        supabaseUrl: 'https://project-ref.supabase.co',
                        supabaseDbPassword: 'super-secret',
                        hostOverride: 'custom.host.internal'
                });

                expect(details.host).toBe('custom.host.internal');
                expect(details.connectionString).toContain('custom.host.internal');
        });

        it('builds the pooler host from the provided region override', () => {
                const details = buildConnectionDetails({
                        supabaseUrl: 'https://project-ref.supabase.co',
                        supabaseDbPassword: 'secret',
                        regionOverride: 'eu-central-1'
                });

                expect(details.host).toBe('aws-0-eu-central-1.pooler.supabase.com');
        });

        it('throws when the region cannot be inferred and no overrides are provided', () => {
                expect(() =>
                        buildConnectionDetails({
                                supabaseUrl: 'https://project-ref.supabase.co',
                                supabaseDbPassword: 'secret'
                        })
                ).toThrow('Unable to determine Supabase database region');
        });
});

describe('buildConnectionDetailsFromEnv', () => {
        it('reads the required values from the provided env bag', () => {
                const details = buildConnectionDetailsFromEnv({
                        SUPABASE_URL: 'https://project-ref.supabase.co',
                        SUPABASE_DB_PASSWORD: 'secret',
                        SUPABASE_DB_REGION: 'ap-south-1'
                } as NodeJS.ProcessEnv);

                expect(details.host).toBe('aws-0-ap-south-1.pooler.supabase.com');
        });
});

describe('pooler host pattern', () => {
        it("matches Supabase's documented aws-0-<region>.pooler.supabase.com pattern across regions", () => {
                const samples = [
                        { url: 'https://project-us.supabase.co', region: 'us-east-1' },
                        { url: 'https://project-ap.supabase.co', region: 'ap-southeast-1' },
                        { url: 'https://project-eu.supabase.co', region: 'eu-central-1' }
                ];

                samples.forEach(({ url, region }) => {
                        const details = buildConnectionDetails({
                                supabaseUrl: url,
                                supabaseDbPassword: 'password',
                                regionOverride: region
                        });
                        expect(details.host).toBe(`aws-0-${region}.pooler.supabase.com`);
                        expect(buildPoolerHost(region)).toBe(`aws-0-${region}.pooler.supabase.com`);
                });
        });
});
