import { QueueService } from '../services/QueueService';
import { ProcessingTask, TaskStatus, TaskType } from '../models/ProcessingTask';
import { DocumentMetadata } from '../models/DocumentChunk';
import { Vault, Notice } from 'obsidian';
import { DEFAULT_SETTINGS } from '../settings/Settings';
import { Neo4jService } from '../services/Neo4jService';
import type { SupabaseService } from '../services/SupabaseService';
import type { EmbeddingService } from '../services/EmbeddingService';
import type { SyncFileManager } from '../services/SyncFileManager';
import type { ErrorHandler } from '../utils/ErrorHandler';
import type { NotificationManager } from '../utils/NotificationManager';

type Neo4jMockModule = typeof import('neo4j-driver') & {
        __privateMocks: {
                runMock: jest.Mock;
                setFailureAfter: (offset: number, code?: string) => void;
                reset: () => void;
        };
};

jest.mock('neo4j-driver', () => {
        let runCallCount = 0;
        let failureAtCall: number | null = null;
        let failureCode = 'ServiceUnavailable';
        const runMock = jest.fn().mockImplementation(() => {
                runCallCount++;
                if (failureAtCall !== null && runCallCount >= failureAtCall) {
                        const error: { code?: string; message: string } & Error = new Error(`Neo4j ${failureCode}`);
                        error.code = failureCode;
                        return Promise.reject(error);
                }
                return Promise.resolve({});
        });
        type MockTx = { run: (...args: any[]) => ReturnType<typeof runMock> };
        const tx: MockTx = { run: (...args: any[]) => runMock(...args) };
        const session = {
                executeWrite: async (handler: (tx: MockTx) => Promise<unknown>) => handler(tx),
                close: jest.fn().mockResolvedValue(undefined),
        };
        const driverInstance = {
                session: () => session,
                close: jest.fn().mockResolvedValue(undefined),
        };
        const driver = jest.fn(() => driverInstance);
        const authBasic = jest.fn();
        return {
                __esModule: true,
                default: { driver, auth: { basic: authBasic } },
                driver,
                auth: { basic: authBasic },
                __privateMocks: {
                        runMock,
                        setFailureAfter(offset: number, code: string = 'ServiceUnavailable') {
                                failureAtCall = runCallCount + offset;
                                failureCode = code;
                        },
                        reset() {
                                runCallCount = 0;
                                failureAtCall = null;
                                failureCode = 'ServiceUnavailable';
                                runMock.mockClear();
                        },
                },
        };
});

describe('Hybrid sync handling when Neo4j fails mid-run', () => {
        const neo4jMock = jest.requireMock('neo4j-driver') as Neo4jMockModule;
        const { __privateMocks } = neo4jMock;

        beforeEach(() => {
                        __privateMocks.reset();
                        (Neo4jService as unknown as { instance: Neo4jService | null }).instance = null;
                        (Notice as jest.Mock).mockClear();
        });

        const buildSupabase = (overrides: Partial<SupabaseService> = {}): SupabaseService =>
                ({
                        upsertChunks: jest.fn().mockResolvedValue(undefined),
                        updateFileVectorizationStatus: jest.fn().mockResolvedValue(undefined),
                        getFileStatusIdByPath: jest.fn().mockResolvedValue(42),
                        deleteDocumentChunks: jest.fn().mockResolvedValue(undefined),
                        ...overrides,
                } as unknown as SupabaseService);

        const buildEmbeddingService = (): EmbeddingService =>
                ({
                        createEmbeddings: jest.fn(async () => [
                                {
                                        data: [{ embedding: [1, 2, 3], index: 0 }],
                                        usage: { prompt_tokens: 1, total_tokens: 1 },
                                        model: 'mock-model',
                                },
                        ]),
                } as unknown as EmbeddingService);

        const buildSyncFileManager = (): SyncFileManager =>
                ({
                        recordHybridFailure: jest.fn().mockResolvedValue(undefined),
                } as unknown as SyncFileManager);

        const buildTask = (): ProcessingTask => {
                const metadata: DocumentMetadata = {
                        obsidianId: 'Note.md',
                        path: 'Note.md',
                        lastModified: Date.now(),
                        created: Date.now(),
                        size: 128,
                        customMetadata: { contentHash: 'abc' },
                };
                return {
                        id: 'Note.md',
                        type: TaskType.CREATE,
                        status: TaskStatus.PENDING,
                        priority: 1,
                        maxRetries: 2,
                        retryCount: 0,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        metadata,
                        data: {},
                };
        };

        async function buildNeo4jService(batchLimit: number): Promise<Neo4jService> {
                const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
                settings.neo4j.url = 'bolt://localhost:7687';
                settings.neo4j.username = 'neo4j';
                settings.neo4j.password = 'password';
                settings.neo4j.projectName = 'hybrid-test';
                settings.neo4j.neo4jBatchLimit = batchLimit;
                const service = await Neo4jService.getInstance(settings);
                if (!service) {
                        throw new Error('Neo4j service failed to initialize');
                }
                return service;
        }

        function buildQueue(options: {
                supabase: SupabaseService;
                syncFileManager: SyncFileManager;
                neo4jService: Neo4jService;
        }): QueueService {
                const embeddingService = buildEmbeddingService();
                const errorHandler = { handleError: jest.fn() } as unknown as ErrorHandler;
                const notificationManager = {
                        updateProgress: jest.fn(),
                        clear: jest.fn(),
                        showNotification: jest.fn(),
                } as unknown as NotificationManager;
                const content = Array.from({ length: 40 })
                        .map((_, idx) => `Paragraph ${idx}`)
                        .join('\n');
                const MockVault = Vault as unknown as { new (initialFiles?: Record<string, string>): Vault };
                const vault = new MockVault({ 'Note.md': content }) as unknown as Vault;
                const queue = new QueueService(
                        1,
                        2,
                        options.supabase,
                        embeddingService,
                        errorHandler,
                        notificationManager,
                        vault,
                        { chunkSize: 60, chunkOverlap: 0, minChunkSize: 20 },
                        {
                                vectorSyncEnabled: true,
                                graphSyncEnabled: true,
                                neo4jService: options.neo4jService,
                                hybridStrategy: { executionOrder: 'vector-first', requireDualWrites: true },
                                syncMode: 'hybrid',
                                graphBuilder: null,
                                syncFileManager: options.syncFileManager,
                        }
                );
                (queue as unknown as { scheduleNextProcessing: () => void }).scheduleNextProcessing = jest.fn();
                return queue;
        }

        it('rolls back Supabase writes, defers the task, and records telemetry when Neo4j becomes unavailable mid-batch', async () => {
                const supabase = buildSupabase();
                const syncFileManager = buildSyncFileManager();
                const neo4jService = await buildNeo4jService(3);
                const queue = buildQueue({ supabase, syncFileManager, neo4jService });
                __privateMocks.setFailureAfter(1, 'ServiceUnavailable');
                const task = buildTask();

                await (queue as any).processTask(task);

                expect(task.status).toBe(TaskStatus.RETRYING);
                expect(task.retryCount).toBe(1);
                expect((queue as any).queue[0]).toBe(task);
                expect(supabase.deleteDocumentChunks).toHaveBeenCalledWith(42, 'Note.md');
                expect(supabase.updateFileVectorizationStatus).toHaveBeenCalledWith(task.metadata, 'pending');
                expect(syncFileManager.recordHybridFailure).toHaveBeenCalledWith(
                        expect.objectContaining({
                                filePath: 'Note.md',
                                rolledBack: true,
                                errorCode: 'NEO4J_HYBRID_WRITE_FAILED',
                        })
                );
                expect((Notice as jest.Mock)).toHaveBeenCalledWith(expect.stringContaining('neo4jBatchLimit'));
                const chunkQueries = __privateMocks.runMock.mock.calls.filter(
                        ([query]) => typeof query === 'string' && query.includes('UNWIND $chunks AS chunk')
                );
                chunkQueries.forEach(([, params]) => {
                        expect(params.chunks.length).toBeLessThanOrEqual(3);
                });
        });

        it('marks failures as retryable with sync-file telemetry when Supabase rollback cannot complete', async () => {
                const supabase = buildSupabase({
                        deleteDocumentChunks: jest.fn().mockRejectedValue(new Error('temporary outage')),
                });
                const syncFileManager = buildSyncFileManager();
                const neo4jService = await buildNeo4jService(2);
                const queue = buildQueue({ supabase, syncFileManager, neo4jService });
                __privateMocks.setFailureAfter(2, 'TransientError');
                const task = buildTask();

                await expect((queue as any).processCreateUpdateTask(task)).rejects.toMatchObject({
                        code: 'NEO4J_HYBRID_WRITE_FAILED',
                });

                expect(supabase.deleteDocumentChunks).toHaveBeenCalled();
                expect(syncFileManager.recordHybridFailure).toHaveBeenCalledWith(
                        expect.objectContaining({ rolledBack: false })
                );
                expect((Notice as jest.Mock).mock.calls.some(([message]) => message.includes('neo4jBatchLimit'))).toBe(true);
        });
});
