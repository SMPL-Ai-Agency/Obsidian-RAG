import { URL } from 'node:url';

const DEFAULT_PORT = 6543;

export interface ConnectionOptions {
        supabaseUrl: string;
        supabaseDbPassword: string;
        hostOverride?: string;
        regionOverride?: string;
        port?: number | string;
}

export interface ConnectionDetails {
        projectRef: string;
        host: string;
        port: number;
        connectionString: string;
}

function ensureValue(value: string | undefined, name: string): string {
        if (!value) {
                throw new Error(`Missing required environment variable \"${name}\". Please update your .env file.`);
        }
        return value;
}

export function extractProjectRef(supabaseUrl: string): string {
	let hostname: string;
	try {
		hostname = new URL(supabaseUrl).hostname;
	} catch (error) {
		throw new Error(`Invalid SUPABASE_URL: ${error instanceof Error ? error.message : String(error)}`);
	}

	const projectMatch = hostname.match(/^([a-z0-9-]+)/i);
	if (!projectMatch) {
		throw new Error('Unable to parse the Supabase project reference from SUPABASE_URL.');
	}

	return projectMatch[1];
}

export function inferRegionFromSupabaseUrl(supabaseUrl: string): string | null {
        let hostname: string;
        try {
                hostname = new URL(supabaseUrl).hostname;
        } catch (error) {
                return null;
        }

        const awsMatch = hostname.match(/aws-\d+-([a-z0-9-]+)\./i);
        if (awsMatch) {
                return awsMatch[1];
        }

        const explicitRegionMatch = hostname.match(/([a-z]{2}-[a-z-]+-\d)\.supabase\./i);
        if (explicitRegionMatch) {
                return explicitRegionMatch[1];
        }

        return null;
}

function normalizeRegion(region: string): string {
        const trimmed = region.trim();
        if (!trimmed) {
                throw new Error('Supabase region overrides cannot be empty.');
        }
        return trimmed.replace(/^aws-\d+-/i, '');
}

export function buildPoolerHost(region: string): string {
        const normalizedRegion = normalizeRegion(region);
        return `aws-0-${normalizedRegion}.pooler.supabase.com`;
}

export function resolveDbHost({
        supabaseUrl,
        hostOverride,
        regionOverride
}: {
        supabaseUrl: string;
        hostOverride?: string;
        regionOverride?: string;
}): string {
        if (hostOverride && hostOverride.trim()) {
                return hostOverride.trim();
        }

        if (regionOverride && regionOverride.trim()) {
                return buildPoolerHost(regionOverride);
        }

        const inferredRegion = inferRegionFromSupabaseUrl(supabaseUrl);
        if (inferredRegion) {
                return buildPoolerHost(inferredRegion);
        }

        throw new Error(
                'Unable to determine Supabase database region from SUPABASE_URL. ' +
                        'Set SUPABASE_DB_REGION or SUPABASE_DB_HOST in your environment to continue.'
        );
}

export function buildConnectionDetails(options: ConnectionOptions): ConnectionDetails {
        const projectRef = extractProjectRef(options.supabaseUrl);
        const host = resolveDbHost({
                supabaseUrl: options.supabaseUrl,
                hostOverride: options.hostOverride,
                regionOverride: options.regionOverride
        });
        const portInput = options.port ?? DEFAULT_PORT;
        const port = typeof portInput === 'string' ? Number(portInput) : portInput;
        if (!Number.isFinite(port) || port <= 0) {
                throw new Error('Invalid Supabase database port.');
        }

        const encodedPassword = encodeURIComponent(options.supabaseDbPassword);
        const connectionString = `postgresql://postgres.${projectRef}:${encodedPassword}@${host}:${port}/postgres?sslmode=require`;

        return {
                projectRef,
                host,
                port,
                connectionString
        };
}

export function buildConnectionDetailsFromEnv(env: NodeJS.ProcessEnv = process.env): ConnectionDetails {
        const supabaseUrl = ensureValue(env.SUPABASE_URL, 'SUPABASE_URL');
        const supabasePassword = ensureValue(env.SUPABASE_DB_PASSWORD, 'SUPABASE_DB_PASSWORD');

        return buildConnectionDetails({
                supabaseUrl,
                supabaseDbPassword: supabasePassword,
                hostOverride: env.SUPABASE_DB_HOST,
                regionOverride: env.SUPABASE_DB_REGION,
                port: env.SUPABASE_DB_PORT
        });
}

if (require.main === module) {
        try {
                const details = buildConnectionDetailsFromEnv();
                process.stdout.write(JSON.stringify(details));
        } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(`❌ ${message}`);
                process.exit(1);
        }
}
