import { OfflineQueueManager, OfflineOperation } from '../services/OfflineQueueManager';
import type { ErrorHandler } from '../utils/ErrorHandler';
import { Notice } from 'obsidian';

describe('OfflineQueueManager reconciliation', () => {
        const errorHandler = { handleError: jest.fn() } as unknown as ErrorHandler;
        const createManager = (supabaseService: any) => {
                const syncFileManager = { updateSyncStatus: jest.fn() };
                const manager = new OfflineQueueManager(errorHandler, supabaseService, syncFileManager as any);
                return { manager, syncFileManager };
        };

        beforeEach(() => {
                jest.clearAllMocks();
        });

        it('updates Supabase when queued create operations are replayed', async () => {
                const supabaseService = {
                        updateFileVectorizationStatus: jest.fn().mockResolvedValue(undefined),
                };
                const { manager } = createManager(supabaseService);
                const operation: OfflineOperation = {
                        id: 'op-1',
                        fileId: 'Note.md',
                        operationType: 'create',
                        timestamp: Date.now(),
                        metadata: { contentHash: 'abc', lastModified: 123 },
                        status: 'pending',
                };
                (manager as any).queue = [operation];

                await manager.processQueue();

                expect(supabaseService.updateFileVectorizationStatus).toHaveBeenCalledWith(
                        expect.objectContaining({
                                obsidianId: 'Note.md',
                                customMetadata: { contentHash: 'abc' },
                        }),
                );
                expect((manager as any).queue).toHaveLength(0);
        });

        it('surfaces readable error details when a non-Error rejection occurs', async () => {
                const supabaseService = {
                        updateFileVectorizationStatus: jest.fn().mockRejectedValue('timeout'),
                };
                const { manager } = createManager(supabaseService);
                const operation: OfflineOperation = {
                        id: 'op-3',
                        fileId: 'Note.md',
                        operationType: 'update',
                        timestamp: Date.now(),
                        metadata: { contentHash: 'hash', lastModified: 456 },
                        status: 'pending',
                };
                (manager as any).queue = [operation];

                await manager.processQueue();

                const queuedOp = (manager as any).queue[0];
                expect(queuedOp.status).toBe('pending');
                expect(queuedOp.errorDetails).toBe('timeout');
                expect(Notice).toHaveBeenCalledWith(
                        expect.stringContaining('timeout')
                );
        });

        it('falls back to SyncFileManager when deleting offline without Supabase connectivity', async () => {
                const syncFileManager = { updateSyncStatus: jest.fn().mockResolvedValue(undefined) };
                const manager = new OfflineQueueManager(errorHandler, null, syncFileManager as any);
                const operation: OfflineOperation = {
                        id: 'op-2',
                        fileId: 'Note.md',
                        operationType: 'delete',
                        timestamp: Date.now(),
                        status: 'pending',
                };
                (manager as any).queue = [operation];
                const originalNavigator = (global as any).navigator;
                (global as any).navigator = { onLine: true };

                await manager.processQueue();

                expect(syncFileManager.updateSyncStatus).toHaveBeenCalledWith('Note.md', 'OK', expect.any(Object));
                expect((manager as any).queue).toHaveLength(0);
                (global as any).navigator = originalNavigator;
        });
});
