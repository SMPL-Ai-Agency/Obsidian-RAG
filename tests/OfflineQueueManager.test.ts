import { OfflineQueueManager, OfflineOperation } from '../services/OfflineQueueManager';
import type { ErrorHandler } from '../utils/ErrorHandler';
import { Notice } from 'obsidian';

const createLocalStorageMock = () => {
        let store: Record<string, string> = {};
        return {
                getItem: jest.fn((key: string) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null)),
                setItem: jest.fn((key: string, value: string) => {
                        store[key] = value;
                }),
                removeItem: jest.fn((key: string) => {
                        delete store[key];
                }),
                clear: jest.fn(() => {
                        store = {};
                }),
                __setBackingStore(next: Record<string, string>) {
                        store = { ...next };
                },
                __getBackingStore() {
                        return { ...store };
                }
        };
};

type LocalStorageMock = ReturnType<typeof createLocalStorageMock>;

describe('OfflineQueueManager reconciliation', () => {
        const errorHandler = { handleError: jest.fn() } as unknown as ErrorHandler;
        const activeManagers: OfflineQueueManager[] = [];
        const trackManager = (manager: OfflineQueueManager) => {
                        activeManagers.push(manager);
                        return manager;
        };
        const createManager = (supabaseService: any) => {
                const syncFileManager = { updateSyncStatus: jest.fn() };
                const manager = trackManager(new OfflineQueueManager(errorHandler, supabaseService, syncFileManager as any));
                return { manager, syncFileManager };
        };
        const originalWindow = (global as any).window;
        const originalNavigator = (global as any).navigator;
        let localStorageMock: LocalStorageMock;

        beforeEach(() => {
                jest.clearAllMocks();
                localStorageMock = createLocalStorageMock();
                (global as any).window = { localStorage: localStorageMock };
                (global as any).navigator = { onLine: true };
        });

        afterEach(() => {
                jest.useRealTimers();
                activeManagers.forEach(manager => manager.destroy());
                activeManagers.length = 0;
        });

        afterAll(() => {
                (global as any).window = originalWindow;
                (global as any).navigator = originalNavigator;
        });

        it('reloads persisted queue entries and primes reconnection scheduling', () => {
                const storedOperations: OfflineOperation[] = [
                        {
                                id: 'persisted-op',
                                fileId: 'Rehydrate.md',
                                operationType: 'update',
                                timestamp: 123,
                                metadata: { contentHash: 'xyz', lastModified: 111 },
                                status: 'pending'
                        }
                ];
                localStorageMock.__setBackingStore({
                        'obsidian-rag-offline-queue': JSON.stringify(storedOperations),
                        'obsidian-rag-offline-processed': JSON.stringify([])
                });

                const supabaseService = { updateFileVectorizationStatus: jest.fn().mockResolvedValue(undefined) };
                const { manager } = createManager(supabaseService);

                expect(manager.getQueuedOperations()).toHaveLength(1);
                expect(manager.getQueuedOperations()[0]).toMatchObject({ fileId: 'Rehydrate.md' });
                expect(localStorageMock.getItem).toHaveBeenCalledWith('obsidian-rag-offline-queue');
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

        it('processes rename operations and updates both Supabase paths', async () => {
                const supabaseService = {
                        updateFileVectorizationStatus: jest.fn().mockResolvedValue(undefined),
                        updateFileStatusOnDelete: jest.fn().mockResolvedValue(undefined)
                };
                const { manager } = createManager(supabaseService);
                const operation: OfflineOperation = {
                        id: 'op-rename-1',
                        fileId: 'New.md',
                        operationType: 'rename',
                        timestamp: Date.now(),
                        metadata: {
                                oldPath: 'Old.md',
                                lastModified: 555
                        },
                        status: 'pending'
                };
                (manager as any).queue = [operation];

                await manager.processQueue();

                expect(supabaseService.updateFileVectorizationStatus).toHaveBeenCalledWith(
                        expect.objectContaining({ obsidianId: 'New.md', path: 'New.md' })
                );
                expect(supabaseService.updateFileStatusOnDelete).toHaveBeenCalledWith('Old.md');
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
                const manager = trackManager(new OfflineQueueManager(errorHandler, null, syncFileManager as any));
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

        it('schedules reconnection retries with exponential backoff and replays on reconnect', async () => {
                jest.useFakeTimers();
                const timeoutSpy = jest.spyOn(global, 'setTimeout');
                const supabaseService = {
                        updateFileVectorizationStatus: jest.fn().mockResolvedValue(undefined)
                };
                const { manager } = createManager(supabaseService);
                const processSpy = jest.spyOn(manager as any, 'processQueue');
                const retryingOp: OfflineOperation = {
                        id: 'retry-1',
                        fileId: 'Backoff.md',
                        operationType: 'update',
                        timestamp: Date.now(),
                        status: 'pending',
                        retryCount: 3
                };
                (manager as any).queue = [retryingOp];
                (global as any).navigator = { onLine: false };

                await manager.processQueue();

                expect(timeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 8000);
                expect(processSpy).toHaveBeenCalledTimes(1);

                (global as any).navigator = { onLine: true };
                await jest.advanceTimersByTimeAsync(8000);

                expect(processSpy).toHaveBeenCalledTimes(2);
                expect(supabaseService.updateFileVectorizationStatus).toHaveBeenCalledTimes(1);
                timeoutSpy.mockRestore();
        });
});
