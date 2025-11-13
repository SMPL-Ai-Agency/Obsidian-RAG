import { QueueService } from '../services/QueueService';
import type { SupabaseService } from '../services/SupabaseService';
import type { EmbeddingService } from '../services/EmbeddingService';
import type { Neo4jService } from '../services/Neo4jService';
import type { EntityExtractor } from '../services/EntityExtractor';
import type { ErrorHandler } from '../utils/ErrorHandler';
import type { NotificationManager } from '../utils/NotificationManager';
import type { SyncMode } from '../settings/Settings';
import { buildVaultWithDocument, createProcessingTask } from './__mocks__/ingestTestUtils';
import type { DocumentMetadata } from '../models/DocumentChunk';

const NOTE_PATH = 'Vault/HybridIngest.md';
const NOTE_CONTENT = `---
 tags: [regression]
 aliases: [Ingest Harness]
---
The first paragraph references [[QueueService]] and #ingest.

A second paragraph keeps chunking deterministic.`;

type SupabaseWriteMock = Pick<SupabaseService, 'upsertChunks' | 'updateFileVectorizationStatus'>;
type Neo4jWriteMock = Pick<Neo4jService, 'upsertDocumentGraph'>;
type EmbeddingWriteMock = Pick<EmbeddingService, 'createEmbeddings'>;
type EntityExtractorMock = Pick<EntityExtractor, 'extractFromDocument'>;

interface Harness {
        queue: QueueService;
        metadata: DocumentMetadata;
        supabaseService: jest.Mocked<SupabaseWriteMock>;
        neo4jService: jest.Mocked<Neo4jWriteMock>;
        embeddingService: jest.Mocked<EmbeddingWriteMock>;
        entityExtractor: jest.Mocked<EntityExtractorMock>;
        cleanup: () => void;
}

const createSupabaseMock = (): jest.Mocked<SupabaseWriteMock> => ({
        upsertChunks: jest.fn().mockResolvedValue(undefined),
        updateFileVectorizationStatus: jest.fn().mockResolvedValue(undefined)
});

const createNeo4jMock = (): jest.Mocked<Neo4jWriteMock> => ({
        upsertDocumentGraph: jest.fn().mockResolvedValue(undefined)
});

const createEmbeddingMock = (): jest.Mocked<EmbeddingWriteMock> => ({
        createEmbeddings: jest.fn(async chunks => [
                {
                        data: [
                                {
                                        embedding: [chunks[0]?.length ?? 0, 1, 2],
                                        index: 0
                                }
                        ],
                        model: 'mock-embedding',
                        usage: { prompt_tokens: chunks[0]?.length ?? 0, total_tokens: chunks[0]?.length ?? 0 }
                }
        ])
});

const createEntityExtractorMock = (): jest.Mocked<EntityExtractorMock> => ({
        extractFromDocument: jest.fn().mockResolvedValue({ entities: [] })
});

const buildHarness = (mode: SyncMode): Harness => {
        const { vault, metadata } = buildVaultWithDocument(NOTE_PATH, NOTE_CONTENT);
        const supabaseService = createSupabaseMock();
        const neo4jService = createNeo4jMock();
        const embeddingService = createEmbeddingMock();
        const entityExtractor = createEntityExtractorMock();
        const errorHandler = { handleError: jest.fn() } as unknown as ErrorHandler;
        const notificationManager = { updateProgress: jest.fn(), clear: jest.fn() } as unknown as NotificationManager;

        const queue = new QueueService(
                1,
                1,
                supabaseService as unknown as SupabaseService,
                embeddingService as unknown as EmbeddingService,
                errorHandler,
                notificationManager,
                vault,
                undefined,
                {
                        vectorSyncEnabled: mode !== 'neo4j',
                        graphSyncEnabled: mode !== 'supabase',
                        neo4jService: neo4jService as unknown as Neo4jService,
                        entityExtractor: entityExtractor as unknown as EntityExtractor,
                        syncMode: mode
                }
        );
        (queue as any).isStopped = false;
        (queue as any).scheduleNextProcessing = () => {};
        const internalSupabase = (queue as any).supabaseService;
        if (internalSupabase !== supabaseService) {
                throw new Error('QueueService replaced the SupabaseService mock instance');
        }

        return {
                queue,
                metadata,
                supabaseService,
                neo4jService,
                embeddingService,
                entityExtractor,
                cleanup: () => queue.stop()
        };
};

const waitForQueueIdle = async (queue: QueueService): Promise<void> => {
        const state = queue as any;
        while ((state.processingQueue?.length ?? 0) > 0 || (state.queue?.length ?? 0) > 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
        }
};

const drainQueueFor = async (queue: QueueService, metadata: DocumentMetadata): Promise<void> => {
        const task = createProcessingTask(metadata);
        await queue.addTask(task);
        await (queue as any).processQueue();
        await waitForQueueIdle(queue);
};

describe('QueueService ingest modes integration', () => {
        it('writes exclusively to Supabase in vector mode', async () => {
                const harness = buildHarness('supabase');
                try {
                        await drainQueueFor(harness.queue, harness.metadata);

                        expect(harness.supabaseService.upsertChunks).toHaveBeenCalledTimes(1);
                        expect(harness.supabaseService.updateFileVectorizationStatus).toHaveBeenCalledWith(
                                harness.metadata,
                                'vectorized'
                        );
                        expect(harness.embeddingService.createEmbeddings).toHaveBeenCalled();
                        expect(harness.neo4jService.upsertDocumentGraph).not.toHaveBeenCalled();
                } finally {
                        harness.cleanup();
                }
        });

        it('writes exclusively to Neo4j in graph mode', async () => {
                const harness = buildHarness('neo4j');
                try {
                        await drainQueueFor(harness.queue, harness.metadata);

                        expect(harness.neo4jService.upsertDocumentGraph).toHaveBeenCalledTimes(1);
                        expect(harness.entityExtractor.extractFromDocument).toHaveBeenCalledWith(
                                expect.any(String),
                                harness.metadata
                        );
                        expect(harness.supabaseService.upsertChunks).not.toHaveBeenCalled();
                        expect(harness.embeddingService.createEmbeddings).not.toHaveBeenCalled();
                } finally {
                        harness.cleanup();
                }
        });

        it('runs vector writes before Neo4j in hybrid mode', async () => {
                const harness = buildHarness('hybrid');
                const callOrder: string[] = [];
                harness.supabaseService.upsertChunks.mockImplementation(async () => {
                        callOrder.push('supabase');
                });
                harness.neo4jService.upsertDocumentGraph.mockImplementation(async () => {
                        callOrder.push('neo4j');
                });

                try {
                        await drainQueueFor(harness.queue, harness.metadata);

                        expect(harness.supabaseService.upsertChunks).toHaveBeenCalledTimes(1);
                        expect(harness.neo4jService.upsertDocumentGraph).toHaveBeenCalledTimes(1);
                        expect(callOrder).toEqual(['supabase', 'neo4j']);
                } finally {
                        harness.cleanup();
                }
        });
});
