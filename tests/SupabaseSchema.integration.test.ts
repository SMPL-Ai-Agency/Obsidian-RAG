import { SupabaseService } from '@/services/SupabaseService';
import { DEFAULT_SETTINGS, type ObsidianRAGSettings } from '@/settings/Settings';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js', () => ({
        createClient: jest.fn()
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

const createSettings = (): ObsidianRAGSettings => ({
        ...DEFAULT_SETTINGS,
        vaultId: 'vault-test',
        supabase: {
                ...DEFAULT_SETTINGS.supabase,
                url: 'http://localhost:54321',
                apiKey: 'service-role-key'
        },
        exclusions: {
                ...DEFAULT_SETTINGS.exclusions,
                excludedFolders: [...DEFAULT_SETTINGS.exclusions.excludedFolders],
                excludedFileTypes: [...DEFAULT_SETTINGS.exclusions.excludedFileTypes],
                excludedFilePrefixes: [...DEFAULT_SETTINGS.exclusions.excludedFilePrefixes],
                excludedFiles: [...DEFAULT_SETTINGS.exclusions.excludedFiles]
        }
});

describe('SupabaseService schema initialization', () => {
        beforeEach(() => {
                jest.clearAllMocks();
                (SupabaseService as unknown as { instance: SupabaseService | null }).instance = null;
        });

        it('creates obsidian_file_status when Supabase reports relation does not exist', async () => {
                const selectBuilder: any = {
                        select: jest.fn().mockReturnThis(),
                        limit: jest.fn().mockResolvedValue({
                                data: null,
                                error: { message: 'relation "obsidian_file_status" does not exist' }
                        })
                };

                const mockClient = {
                        from: jest.fn(() => selectBuilder)
                };

                mockCreateClient.mockReturnValue(mockClient as any);

                const service = new (SupabaseService as any)(createSettings()) as SupabaseService;
                const creationSpy = jest
                        .spyOn(service as any, 'createFileStatusTable')
                        .mockResolvedValue(undefined);

                await (service as any).initializeFileStatusTable();

                expect(mockClient.from).toHaveBeenCalledWith('obsidian_file_status');
                expect(creationSpy).toHaveBeenCalledTimes(1);
        });
});
