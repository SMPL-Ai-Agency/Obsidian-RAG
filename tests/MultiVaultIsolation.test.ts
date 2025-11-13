import { SupabaseService } from '../services/SupabaseService';
import { Neo4jService } from '../services/Neo4jService';
import { DocumentChunk, DocumentMetadata } from '../models/DocumentChunk';
import { DEFAULT_SETTINGS, type ObsidianRAGSettings } from '../settings/Settings';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js', () => ({
        createClient: jest.fn()
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

const cloneSettings = (): ObsidianRAGSettings => ({
        ...DEFAULT_SETTINGS,
        vaultId: 'vault-alpha',
        supabase: {
                ...DEFAULT_SETTINGS.supabase,
                url: 'https://project.supabase.co',
                apiKey: 'anon-key'
        },
        neo4j: {
                ...DEFAULT_SETTINGS.neo4j,
                url: 'bolt://localhost:7687',
                username: 'neo4j',
                password: 'pass',
                database: 'neo4j',
                projectName: 'project-blue'
        },
        exclusions: {
                ...DEFAULT_SETTINGS.exclusions,
                excludedFolders: [...DEFAULT_SETTINGS.exclusions.excludedFolders],
                excludedFileTypes: [...DEFAULT_SETTINGS.exclusions.excludedFileTypes],
                excludedFilePrefixes: [...DEFAULT_SETTINGS.exclusions.excludedFilePrefixes],
                excludedFiles: [...DEFAULT_SETTINGS.exclusions.excludedFiles]
        }
});

const createChunk = (metadata: DocumentMetadata): DocumentChunk => ({
        vault_id: 'vault-alpha',
        file_status_id: 0,
        chunk_index: 0,
        content: 'Chunk content',
        metadata: { ...metadata, graphChunkId: `${metadata.path}::0` },
        embedding: [0.1, 0.2],
        vectorized_at: new Date().toISOString()
});

describe('Multi-vault isolation across storage layers', () => {
        beforeEach(() => {
                jest.clearAllMocks();
                (SupabaseService as unknown as { instance: SupabaseService | null }).instance = null;
        });

it('writes Supabase chunks with the active vault id for isolation', async () => {
const singleMock = jest.fn().mockResolvedValue({ data: { id: 42 }, error: null });
const selectMock = jest.fn(() => ({ single: singleMock }));
const upsertMock = jest.fn(() => ({ select: selectMock }));
const deleteBuilder = {
delete: jest.fn(() => deleteBuilder),
eq: jest.fn(() => deleteBuilder),
contains: jest.fn(() => Promise.resolve({ data: null, error: null }))
};
const insertBuilder = {
insert: jest.fn(() => Promise.resolve({ data: null, error: null }))
};
let documentCallCount = 0;
const fromMock = jest.fn((table: string) => {
if (table === 'obsidian_file_status') {
return { upsert: upsertMock };
}
if (table === 'documents') {
documentCallCount += 1;
return documentCallCount === 1 ? deleteBuilder : insertBuilder;
}
throw new Error(`Unexpected table ${table}`);
});

const mockClient = {
from: fromMock
};

mockCreateClient.mockReturnValue(mockClient as any);
const settings = cloneSettings();
const service = new (SupabaseService as any)(settings) as SupabaseService;
const metadata: DocumentMetadata = {
obsidianId: 'ProjectA/Note.md',
path: 'ProjectA/Note.md',
lastModified: 1714768260000,
created: 1714768200000,
size: 128,
tags: ['projectA'],
aliases: ['note-a'],
links: ['ProjectA/Index.md'],
customMetadata: { contentHash: 'hash-a' }
};
const chunk = createChunk(metadata);

await service.upsertChunks([chunk]);

expect(upsertMock).toHaveBeenCalledWith(
expect.objectContaining({
vault_id: 'vault-alpha',
file_path: metadata.obsidianId
}),
expect.objectContaining({ onConflict: 'vault_id,file_path' })
);
expect(deleteBuilder.eq).toHaveBeenCalledWith('project_name', 'vault-alpha');
expect(deleteBuilder.contains).toHaveBeenCalledWith({ file_status_id: 42 });
expect(insertBuilder.insert).toHaveBeenCalledWith(
expect.arrayContaining([
expect.objectContaining({
project_name: 'vault-alpha'
})
])
);
});

        const buildNeo4jHarness = () => {
                const service = Object.create(Neo4jService.prototype) as Neo4jService;
                const txRunMock = jest.fn().mockResolvedValue(undefined);
                const sessionMock = {
                        executeWrite: jest.fn(async (callback: any) => callback({ run: txRunMock })),
                        close: jest.fn().mockResolvedValue(undefined)
                };
                const driverMock = {
                        session: jest.fn(() => sessionMock)
                };
                (service as any).driver = driverMock;
                (service as any).projectName = 'project-blue';
                (service as any).settings = { database: 'neo4j' };
                return { service, txRunMock, sessionMock };
        };

        it('scopes Neo4j upserts to the configured project name', async () => {
                const { service, txRunMock, sessionMock } = buildNeo4jHarness();
                const metadata: DocumentMetadata = {
                        obsidianId: 'Client/Note.md',
                        path: 'Client/Note.md',
                        lastModified: Date.now(),
                        created: Date.now() - 1000,
                        size: 256,
                        tags: ['client'],
                        aliases: ['client-note'],
                        links: ['Client/Index.md'],
                };
                const chunk = createChunk(metadata);
                const extraction = {
                        entities: [
                                {
                                        id: 'entity-1',
                                        name: 'Alice',
                                        type: 'Person',
                                        summary: 'Key contact',
                                        sourcePath: metadata.path,
                                        importance: 2
                                }
                        ],
                        relationships: [
                                {
                                        sourceId: 'entity-1',
                                        targetId: 'entity-1',
                                        type: 'related_to',
                                        description: 'Self link for isolation'
                                }
                        ]
                };

                await service.upsertDocumentGraph(metadata, [chunk], extraction as any);

                expect(sessionMock.executeWrite).toHaveBeenCalled();
                expect(sessionMock.close).toHaveBeenCalled();
                expect(txRunMock).toHaveBeenCalled();
                txRunMock.mock.calls.forEach(([query, params]) => {
                        expect(query).toContain('project_name');
                        expect(params.projectName).toBe('project-blue');
                });
        });

        it('scopes Neo4j deletions to the configured project name', async () => {
                const { service, txRunMock } = buildNeo4jHarness();
                await service.deleteDocument('Client/Archive.md');
                expect(txRunMock).toHaveBeenCalledWith(
                        expect.stringContaining('project_name'),
                        expect.objectContaining({ projectName: 'project-blue', path: 'Client/Archive.md' })
                );
        });
});
