/**
 * @jest-environment jsdom
 */
import { App } from 'obsidian';
import { NotificationManager } from '../utils/NotificationManager';

beforeAll(() => {
        (HTMLElement.prototype as any).addClass = function (className: string) {
                this.classList.add(className);
        };
});

describe('NotificationManager entity preview controls', () => {
        const createManager = (options: { enableProgressBar?: boolean; enableEntityPreview?: boolean } = {}) => {
                const app = {
                        vault: {
                                getAbstractFileByPath: jest.fn()
                        },
                        workspace: {
                                openLinkText: jest.fn()
                        }
                } as unknown as App;
                const statusBarEl = document.createElement('div');
                const manager = new NotificationManager(
                        app,
                        statusBarEl,
                        true,
                        options.enableProgressBar ?? false,
                        options.enableEntityPreview ?? true
                );
                return { manager, statusBarEl };
        };

        it('renders entity previews even when the progress bar is disabled', () => {
                const { manager, statusBarEl } = createManager({ enableProgressBar: false, enableEntityPreview: true });
                manager.updateEntityPreview({
                        notePath: 'Daily/Today.md',
                        entities: [
                                { name: 'Ada Lovelace', type: 'person', importance: 0.95 },
                                { name: 'Charles Babbage', type: 'person', importance: 0.9 }
                        ],
                        relationships: [{ src: 'Ada Lovelace', tgt: 'Charles Babbage', description: 'collaborators' }]
                });
                const panel = statusBarEl.querySelector('.obsidian-rag-entity-preview');
                expect(panel).not.toBeNull();
                expect(panel?.querySelectorAll('.obsidian-rag-entity-preview__entity').length).toBeGreaterThan(0);
        });

        it('destroys and blocks entity previews when the feature flag is disabled', () => {
                const { manager, statusBarEl } = createManager({ enableProgressBar: true, enableEntityPreview: true });
                manager.updateEntityPreview({
                        notePath: 'Projects/AI.md',
                        entities: [{ name: 'Project Atlas', type: 'project' }]
                });
                expect(statusBarEl.querySelector('.obsidian-rag-entity-preview')).not.toBeNull();

                manager.updateSettings(true, true, false);
                expect(statusBarEl.querySelector('.obsidian-rag-entity-preview')).toBeNull();

                manager.updateEntityPreview({
                        notePath: 'Projects/AI.md',
                        entities: [{ name: 'Project Borealis', type: 'project' }]
                });
                expect(statusBarEl.querySelector('.obsidian-rag-entity-preview')).toBeNull();
        });
});
