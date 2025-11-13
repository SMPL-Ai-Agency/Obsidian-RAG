import { QueueService } from '../services/QueueService';
import { TaskType, TaskStatus, ProcessingTask, TaskProcessingError } from '../models/ProcessingTask';
import type { ErrorHandler } from '../utils/ErrorHandler';
import type { NotificationManager } from '../utils/NotificationManager';
import { Vault } from 'obsidian';
import type { DocumentMetadata } from '../models/DocumentChunk';

const createMetadata = (): DocumentMetadata => ({
        obsidianId: 'Note.md',
        path: 'Note.md',
        lastModified: Date.now(),
        created: Date.now(),
        size: 10,
        customMetadata: {},
});

const createTask = (id: string, type: TaskType): ProcessingTask => ({
        id,
        type,
        status: TaskStatus.PENDING,
        priority: 1,
        maxRetries: 3,
        retryCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: createMetadata(),
        data: {},
});

const buildQueueService = () => {
        const errorHandler = { handleError: jest.fn() } as unknown as ErrorHandler;
        const notificationManager = { updateProgress: jest.fn(), clear: jest.fn() } as unknown as NotificationManager;
        const queueService = new QueueService(2, 3, null as any, null as any, errorHandler, notificationManager, new Vault() as any);
        return queueService;
};

describe('QueueService edge cases', () => {
        it('throws when attempting to enqueue beyond the max queue size', async () => {
                const queueService = buildQueueService();
                (queueService as any).queue = Array(1000).fill(createTask('existing', TaskType.CREATE));

                await expect(queueService.addTask(createTask('overflow', TaskType.CREATE))).rejects.toThrow(
                        TaskProcessingError.QUEUE_FULL,
                );
        });

        it('replaces existing tasks with delete operations and prioritizes them', async () => {
                const queueService = buildQueueService();
                await queueService.addTask(createTask('Note.md', TaskType.CREATE));
                await queueService.addTask(createTask('Note.md', TaskType.DELETE));

                const queue = (queueService as any).queue;
                expect(queue).toHaveLength(1);
                expect(queue[0].type).toBe(TaskType.DELETE);
                expect(queue[0].priority).toBe(3);
        });

        it('ignores update tasks when a delete task for the same file is pending', async () => {
                const queueService = buildQueueService();
                await queueService.addTask(createTask('Note.md', TaskType.DELETE));
                await queueService.addTask(createTask('Note.md', TaskType.UPDATE));

                const queue = (queueService as any).queue;
                expect(queue).toHaveLength(1);
                expect(queue[0].type).toBe(TaskType.DELETE);
        });
});

describe('QueueService service availability by sync mode', () => {
        const errorHandler = { handleError: jest.fn() } as unknown as ErrorHandler;
        const notificationManager = { updateProgress: jest.fn(), clear: jest.fn() } as unknown as NotificationManager;

        const buildService = (options: {
                vectorSyncEnabled: boolean;
                graphSyncEnabled: boolean;
                supabaseService?: object | null;
                embeddingService?: object | null;
                neo4jService?: object | null;
        }) =>
                new QueueService(
                        1,
                        1,
                        (options.supabaseService ?? null) as any,
                        (options.embeddingService ?? null) as any,
                        errorHandler,
                        notificationManager,
                        new Vault() as any,
                        undefined,
                        {
                                vectorSyncEnabled: options.vectorSyncEnabled,
                                graphSyncEnabled: options.graphSyncEnabled,
                                neo4jService: (options.neo4jService ?? null) as any,
                        }
                );

        it('requires Supabase + embeddings when running in Supabase-only mode', () => {
                const supabaseOffline = buildService({
                        vectorSyncEnabled: true,
                        graphSyncEnabled: false,
                        supabaseService: null,
                        embeddingService: null,
                });
                const supabaseOnline = buildService({
                        vectorSyncEnabled: true,
                        graphSyncEnabled: false,
                        supabaseService: {},
                        embeddingService: { createEmbeddings: jest.fn() },
                });

                expect((supabaseOffline as any).areCoreServicesAvailable()).toBe(false);
                expect((supabaseOnline as any).areCoreServicesAvailable()).toBe(true);
        });

        it('treats Neo4j-only mode as online even without Supabase services', () => {
                const neo4jOffline = buildService({
                        vectorSyncEnabled: false,
                        graphSyncEnabled: true,
                        neo4jService: null,
                });
                const neo4jOnline = buildService({
                        vectorSyncEnabled: false,
                        graphSyncEnabled: true,
                        neo4jService: { upsertDocumentGraph: jest.fn() },
                });

                expect((neo4jOffline as any).areCoreServicesAvailable()).toBe(false);
                expect((neo4jOnline as any).areCoreServicesAvailable()).toBe(true);
        });

        it('requires both backends when hybrid mode is enabled', () => {
                const hybridMissingGraph = buildService({
                        vectorSyncEnabled: true,
                        graphSyncEnabled: true,
                        supabaseService: {},
                        embeddingService: { createEmbeddings: jest.fn() },
                        neo4jService: null,
                });
                const hybridMissingVectors = buildService({
                        vectorSyncEnabled: true,
                        graphSyncEnabled: true,
                        supabaseService: null,
                        embeddingService: null,
                        neo4jService: { upsertDocumentGraph: jest.fn() },
                });
                const hybridOnline = buildService({
                        vectorSyncEnabled: true,
                        graphSyncEnabled: true,
                        supabaseService: {},
                        embeddingService: { createEmbeddings: jest.fn() },
                        neo4jService: { upsertDocumentGraph: jest.fn() },
                });

                expect((hybridMissingGraph as any).areCoreServicesAvailable()).toBe(false);
                expect((hybridMissingVectors as any).areCoreServicesAvailable()).toBe(false);
                expect((hybridOnline as any).areCoreServicesAvailable()).toBe(true);
        });
});
