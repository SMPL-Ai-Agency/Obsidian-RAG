import { ErrorHandler } from '../utils/ErrorHandler';
import type { DebugSettings } from '../settings/Settings';
import { Notice } from 'obsidian';

describe('ErrorHandler notices', () => {
        const baseSettings: DebugSettings = {
                enableDebugLogs: false,
                logLevel: 'error',
                logToFile: false
        };

        beforeEach(() => {
                (Notice as unknown as jest.Mock).mockClear();
        });

        it('uses the normalized error message for non-Error inputs', () => {
                const handler = new ErrorHandler(baseSettings);

                handler.handleError('string failure', { context: 'Testing' });

                expect((Notice as unknown as jest.Mock).mock.calls[0][0]).toContain('string failure');
        });

        it('includes contextual metadata when available', () => {
                const handler = new ErrorHandler(baseSettings);

                handler.handleError(new Error('Task failed'), {
                        context: 'Queue processor',
                        taskId: 'task-123',
                        taskType: 'sync',
                        metadata: { file: 'note.md' }
                });

                const noticeArg = (Notice as unknown as jest.Mock).mock.calls[0][0] as string;

                expect(noticeArg).toContain('Task failed');
                expect(noticeArg).toContain('Queue processor');
                expect(noticeArg).toContain('task: sync');
                expect(noticeArg).toContain('taskId: task-123');
                expect(noticeArg).toContain('metadata: {"file":"note.md"}');
        });
});
