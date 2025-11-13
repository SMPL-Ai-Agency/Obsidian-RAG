/// <reference types="jest" />
import { QueueService } from '../services/QueueService';
import { ProcessingTask, TaskStatus, TaskType } from '../models/ProcessingTask';
import { DocumentChunk, DocumentMetadata } from '../models/DocumentChunk';
import { SupabaseService } from '../services/SupabaseService';
import { EmbeddingService } from '../services/EmbeddingService';
import { ErrorHandler } from '../utils/ErrorHandler';
import { NotificationManager } from '../utils/NotificationManager';
import { Vault } from 'obsidian';
import { Neo4jService } from '../services/Neo4jService';

describe('QueueService processDeleteTask', () => {
        const createTask = (): ProcessingTask => {
                const metadata: DocumentMetadata = {
                        obsidianId: 'Test.md',
                        path: 'Test.md',
                        lastModified: Date.now(),
                        created: Date.now(),
                        size: 100
                };

                return {
                        id: 'task-1',
                        type: TaskType.DELETE,
                        status: TaskStatus.PENDING,
                        priority: 1,
                        maxRetries: 3,
                        retryCount: 0,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        metadata,
                        data: {}
                };
        };

        const createChunk = (fileStatusId: number): DocumentChunk => ({
                vault_id: 'vault-1',
                file_status_id: fileStatusId,
                chunk_index: 0,
                content: 'chunk content',
                metadata: {},
                embedding: [0.1],
                vectorized_at: new Date().toISOString()
        });

        const createQueueService = (supabaseService: Partial<SupabaseService>) => {
                const errorHandler = { handleError: jest.fn() } as unknown as ErrorHandler;
                const notificationManager = {
                        updateProgress: jest.fn(),
                        clear: jest.fn()
                } as unknown as NotificationManager;
                return {
                        queueService: new QueueService(
                                2,
                                3,
                                supabaseService as SupabaseService,
                                null as unknown as EmbeddingService,
                                errorHandler,
                                notificationManager,
                                {} as Vault,
                                undefined,
                                { vectorSyncEnabled: true, graphSyncEnabled: false }
                        ),
                        notificationManager
                };
        };

        const createGraphQueueService = (neo4jService: Partial<Neo4jService>) => {
                const errorHandler = { handleError: jest.fn() } as unknown as ErrorHandler;
                const notificationManager = {
                        updateProgress: jest.fn(),
                        clear: jest.fn()
                } as unknown as NotificationManager;
                return {
                        queueService: new QueueService(
                                2,
                                3,
                                null,
                                null,
                                errorHandler,
                                notificationManager,
                                {} as Vault,
                                undefined,
                                { vectorSyncEnabled: false, graphSyncEnabled: true, neo4jService: neo4jService as Neo4jService }
                        ),
                        notificationManager
                };
        };

        it('removes chunks using the resolved file status id without retrying on success', async () => {
                const fileStatusId = 42;
                const supabaseService = {
                        getFileStatusIdByPath: jest.fn().mockResolvedValue(fileStatusId),
                        getDocumentChunks: jest
                                .fn()
                                .mockResolvedValueOnce([createChunk(fileStatusId)])
                                .mockResolvedValueOnce([]),
                        deleteDocumentChunks: jest.fn().mockResolvedValue(undefined),
                        updateFileStatusOnDelete: jest.fn().mockResolvedValue(undefined)
                } as Partial<SupabaseService>;

                const { queueService } = createQueueService(supabaseService);
                const task = createTask();

                await (queueService as any).processDeleteTask(task);

                expect(supabaseService.getFileStatusIdByPath).toHaveBeenCalledWith('Test.md');
                expect(supabaseService.getDocumentChunks).toHaveBeenNthCalledWith(1, fileStatusId);
                expect(supabaseService.deleteDocumentChunks).toHaveBeenCalledTimes(1);
                expect(supabaseService.deleteDocumentChunks).toHaveBeenCalledWith(fileStatusId, 'Test.md');
                expect(supabaseService.getDocumentChunks).toHaveBeenNthCalledWith(2, fileStatusId);
                expect(supabaseService.updateFileStatusOnDelete).toHaveBeenCalledWith('Test.md');
        });

        it('retries chunk deletion when the first delete attempt fails', async () => {
                jest.useFakeTimers();
                const fileStatusId = 99;
                const supabaseService = {
                        getFileStatusIdByPath: jest.fn().mockResolvedValue(fileStatusId),
                        getDocumentChunks: jest
                                .fn()
                                .mockResolvedValueOnce([createChunk(fileStatusId)])
                                .mockResolvedValueOnce([]),
                        deleteDocumentChunks: jest
                                .fn()
                                .mockRejectedValueOnce(new Error('temporary failure'))
                                .mockResolvedValueOnce(undefined),
                        updateFileStatusOnDelete: jest.fn().mockResolvedValue(undefined)
                } as Partial<SupabaseService>;

                const { queueService, notificationManager } = createQueueService(supabaseService);
                const task = createTask();

                const processPromise = (queueService as any).processDeleteTask(task);

                await Promise.resolve();
                await jest.advanceTimersByTimeAsync(2000);
                await processPromise;

                expect(supabaseService.deleteDocumentChunks).toHaveBeenCalledTimes(2);
                expect(supabaseService.deleteDocumentChunks).toHaveBeenNthCalledWith(1, fileStatusId, 'Test.md');
                expect(supabaseService.deleteDocumentChunks).toHaveBeenNthCalledWith(2, fileStatusId, 'Test.md');
                expect(supabaseService.getDocumentChunks).toHaveBeenNthCalledWith(1, fileStatusId);
                expect(supabaseService.getDocumentChunks).toHaveBeenNthCalledWith(2, fileStatusId);
                expect(notificationManager.updateProgress).toHaveBeenCalledWith(
                        expect.objectContaining({
                                taskId: task.id,
                                progress: 50,
                                currentStep: 'Will retry deletion in 2s'
                        })
                );
                expect(supabaseService.updateFileStatusOnDelete).toHaveBeenCalledWith('Test.md');
                jest.useRealTimers();
        });

        it('invokes Neo4j deletion and reports graph progress when graph sync is enabled', async () => {
                const neo4jService = {
                        deleteDocument: jest.fn().mockResolvedValue(undefined)
                } as Partial<Neo4jService>;

                const { queueService, notificationManager } = createGraphQueueService(neo4jService);
                const task = createTask();

                await (queueService as any).processDeleteTask(task);

                expect(neo4jService.deleteDocument).toHaveBeenCalledWith('Test.md');
                expect(notificationManager.updateProgress).toHaveBeenCalledWith(
                        expect.objectContaining({
                                taskId: task.id,
                                progress: 60,
                                currentStep: 'Removing graph nodes'
                        })
                );
                expect(notificationManager.updateProgress).toHaveBeenCalledWith(
                        expect.objectContaining({
                                taskId: task.id,
                                progress: 100,
                                currentStep: 'Delete completed'
                        })
                );
        });

        it('propagates Neo4j deletion failures after notifying graph progress', async () => {
                const neo4jService = {
                        deleteDocument: jest.fn().mockRejectedValue(new Error('neo4j down'))
                } as Partial<Neo4jService>;

                const { queueService, notificationManager } = createGraphQueueService(neo4jService);
                const task = createTask();

                await expect((queueService as any).processDeleteTask(task)).rejects.toThrow('neo4j down');

                expect(neo4jService.deleteDocument).toHaveBeenCalledWith('Test.md');
                expect(notificationManager.updateProgress).toHaveBeenCalledWith(
                        expect.objectContaining({
                                taskId: task.id,
                                progress: 60,
                                currentStep: 'Removing graph nodes'
                        })
                );
                expect(notificationManager.updateProgress).not.toHaveBeenCalledWith(
                        expect.objectContaining({ currentStep: 'Delete completed' })
                );
        });
});
