import { Neo4jService } from '../services/Neo4jService';
import { DEFAULT_SETTINGS } from '../settings/Settings';
import { DocumentChunk, DocumentMetadata } from '../models/DocumentChunk';
import { EntityExtractionResult } from '../services/EntityExtractor';

type Neo4jMockModule = typeof import('neo4j-driver') & {
        __privateMocks: {
                runMock: jest.Mock;
        };
};

jest.mock('neo4j-driver', () => {
        const runMock = jest.fn().mockResolvedValue(undefined);
        type MockTx = { run: jest.Mock };
        const tx: MockTx = { run: runMock };
        const session = {
                close: jest.fn().mockResolvedValue(undefined),
                executeWrite: async (handler: (tx: MockTx) => Promise<void>) => handler(tx),
        };
        const driverInstance = {
                session: () => session,
                close: jest.fn(),
        };
        const driverFactory = jest.fn(() => driverInstance);
        const authBasic = jest.fn();
        return {
                __esModule: true,
                default: { driver: driverFactory, auth: { basic: authBasic } },
                driver: driverFactory,
                auth: { basic: authBasic },
                __privateMocks: {
                        runMock,
                },
        };
});

describe('Neo4jService batch safeguards', () => {
        const { __privateMocks } = jest.requireMock('neo4j-driver') as Neo4jMockModule;
        const runMock = __privateMocks.runMock;

        beforeEach(() => {
                runMock.mockClear();
                // reset singleton between tests
                (Neo4jService as unknown as { instance: Neo4jService | null }).instance = null;
        });

        it('splits chunk/entity payloads according to the configured batch size', async () => {
                const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
                settings.neo4j.password = 'pass';
                settings.neo4j.projectName = 'integration-test';
                settings.neo4j.maxBatchSize = 50;
                const batchSize = settings.neo4j.maxBatchSize;
                const service = await Neo4jService.getInstance(settings);
                if (!service) {
                        throw new Error('Service was not initialized');
                }

                const metadata: DocumentMetadata = {
                        obsidianId: '123',
                        path: 'Example.md',
                        lastModified: Date.now(),
                        created: Date.now(),
                        size: 42,
                };
                const chunkCount = batchSize + 5;
                const chunks: DocumentChunk[] = Array.from({ length: chunkCount }).map((_, index) => ({
                        id: index,
                        vault_id: 'vault',
                        file_status_id: index,
                        chunk_index: index,
                        content: `Chunk ${index}`,
                        metadata: {},
                        embedding: [index],
                        vectorized_at: new Date().toISOString(),
                }));
                const extraction: EntityExtractionResult = {
                        entities: Array.from({ length: chunkCount }).map((_, index) => ({
                                id: `entity-${index}`,
                                name: `Entity ${index}`,
                                type: 'Concept',
                                summary: '',
                                sourcePath: metadata.path,
                        })),
                        relationships: Array.from({ length: chunkCount }).map((_, index) => ({
                                sourceId: `entity-${index}`,
                                targetId: `entity-${(index + 1) % chunkCount}`,
                                type: 'related_to',
                                description: '',
                        })),
                };

                await service.upsertDocumentGraph(metadata, chunks, extraction);

                const chunkQueries = runMock.mock.calls.filter(([query]) =>
                        typeof query === 'string' && query.includes('UNWIND $chunks AS chunk')
                );
                expect(chunkQueries.length).toBeGreaterThan(1);
                for (const [, params] of chunkQueries) {
                        expect(params.chunks.length).toBeLessThanOrEqual(batchSize);
                }

                const entityQueries = runMock.mock.calls.filter(([, params]) => Array.isArray(params?.entities));
                entityQueries.forEach(([, params]) => {
                        expect(params.entities.length).toBeLessThanOrEqual(batchSize);
                });

                const relationshipQueries = runMock.mock.calls.filter(([, params]) => Array.isArray(params?.relationships));
                relationshipQueries.forEach(([, params]) => {
                        expect(params.relationships.length).toBeLessThanOrEqual(batchSize);
                });
        });
});
