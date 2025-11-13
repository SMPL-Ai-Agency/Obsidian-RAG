// src/utils/NotificationManager.ts
import { App, Notice, TFile } from 'obsidian';
import { TaskProgress } from '../models/ProcessingTask';

export class NotificationManager {
	private fixedProgressBar: {
		container: HTMLElement;
		fill: HTMLElement;
		text: HTMLElement;
	} | null = null;
	private statusBarItem: HTMLElement;
private enableNotifications: boolean;
private enableProgressBar: boolean;
private readonly app: App;
        private notificationQueue: string[] = [];
        private isProcessingQueue: boolean = false;
        private entityPreviewPanel: HTMLElement | null = null;
        private entityPreviewList: HTMLElement | null = null;
        private entityPreviewMeta: HTMLElement | null = null;
private entityPreviewRelations: HTMLElement | null = null;
private entityPreviewAction: HTMLButtonElement | null = null;
private entityPreviewNotePath: string | null = null;

constructor(
app: App,
statusBarEl: HTMLElement,
enableNotifications: boolean,
enableProgressBar: boolean
) {
this.app = app;
this.statusBarItem = statusBarEl;
this.enableNotifications = enableNotifications;
this.enableProgressBar = enableProgressBar;
this.initializeStatusBar();
}

	/**
	 * Shows a notification message.
	 */
	showNotification(message: string, duration: number = 4000): void {
		if (!this.enableNotifications) return;
		// Queue notification to avoid spamming the UI.
		this.notificationQueue.push(message);
		if (!this.isProcessingQueue) {
			this.processNotificationQueue();
		}
	}

	/**
	 * Updates the fixed progress bar with the current progress (in percent) and status message.
	 */
        updateProgress(progress: TaskProgress): void {
                if (!this.enableProgressBar) return;
                // Create the fixed progress bar if it doesn't exist.
                if (!this.fixedProgressBar) {
                        this.fixedProgressBar = this.createFixedProgressBar();
                }
                const progressPercentage = Math.round(progress.progress);
                this.fixedProgressBar.fill.style.width = `${progressPercentage}%`;
                // Display the percentage along with a custom status message.
                this.fixedProgressBar.text.textContent = `${progressPercentage}% - ${progress.currentStep} (${progress.currentStepNumber}/${progress.totalSteps})`;
        }

        updateEntityPreview(payload: {
                notePath: string;
                entities: { name: string; type?: string; importance?: number; summary?: string }[];
                relationships?: { src: string; tgt: string; weight?: number; description?: string }[];
        }): void {
                if (!this.enableProgressBar) return;
                if (!payload.entities?.length) {
                        this.clearEntityPreview();
                        return;
                }
                this.ensureEntityPreviewPanel();
                if (!this.entityPreviewList || !this.entityPreviewMeta || !this.entityPreviewRelations) {
                        return;
                }
this.entityPreviewMeta.textContent = `${payload.entities.length} entities • ${(payload.relationships?.length || 0)} links`;
this.entityPreviewNotePath = payload.notePath;
if (this.entityPreviewAction) {
this.entityPreviewAction.disabled = !payload.notePath;
if (payload.notePath) {
this.entityPreviewAction.textContent = `Open ${payload.notePath.split('/').pop()}`;
this.entityPreviewAction.setAttribute('aria-label', `Open ${payload.notePath}`);
} else {
this.entityPreviewAction.removeAttribute('aria-label');
}
}
                this.entityPreviewList.innerHTML = '';
                payload.entities.slice(0, 6).forEach(entity => {
                        const item = document.createElement('li');
                        item.addClass('obsidian-rag-entity-preview__entity');
                        const name = document.createElement('span');
                        name.addClass('obsidian-rag-entity-preview__entity-name');
                        name.textContent = entity.name;
                        const type = document.createElement('span');
                        type.addClass('obsidian-rag-entity-preview__entity-type');
                        type.textContent = entity.type || 'unknown';
                        const importance = document.createElement('span');
                        importance.addClass('obsidian-rag-entity-preview__entity-importance');
                        if (typeof entity.importance === 'number') {
                                importance.textContent = `score ${entity.importance.toFixed(2)}`;
                        } else {
                                importance.textContent = entity.summary ? entity.summary.slice(0, 80) : '';
                        }
                        item.appendChild(name);
                        item.appendChild(type);
                        if (importance.textContent) {
                                item.appendChild(importance);
                        }
                        this.entityPreviewList.appendChild(item);
                });
                const relationshipsPreview = (payload.relationships || []).slice(0, 4);
                if (relationshipsPreview.length) {
                        const relationshipText = relationshipsPreview
                                .map(rel => `${rel.src} → ${rel.tgt}${typeof rel.weight === 'number' ? ` (${rel.weight.toFixed(2)})` : ''}`)
                                .join(' · ');
                        this.entityPreviewRelations.textContent = relationshipText;
                } else {
                        this.entityPreviewRelations.textContent = '';
                }
        }

	/**
	 * Initializes the status bar container.
	 */
        private initializeStatusBar(): void {
                // Clear any existing content.
                this.statusBarItem.innerHTML = '';
                // Create a container element (if needed) to host the fixed progress bar.
                const container = document.createElement('div');
                container.addClass('fixed-progress-container');
                this.statusBarItem.appendChild(container);
        }

	/**
	 * Creates a fixed progress bar element.
	 */
	private createFixedProgressBar(): { container: HTMLElement; fill: HTMLElement; text: HTMLElement } {
		const container = document.createElement('div');
		container.addClass('fixed-progress-bar-container');

		const bar = document.createElement('div');
		bar.addClass('fixed-progress-bar');

		const fill = document.createElement('div');
		fill.addClass('fixed-progress-fill');

		const text = document.createElement('div');
		text.addClass('fixed-progress-text');

		bar.appendChild(fill);
		container.appendChild(bar);
		container.appendChild(text);
		this.statusBarItem.appendChild(container);

		return { container, fill, text };
	}

	/**
	 * Processes the notification queue sequentially.
	 */
	private async processNotificationQueue(): Promise<void> {
		if (this.isProcessingQueue || this.notificationQueue.length === 0) return;
		this.isProcessingQueue = true;
		try {
			while (this.notificationQueue.length > 0) {
				const message = this.notificationQueue.shift();
				if (message) {
					new Notice(message);
					// Wait a bit between notifications to avoid spamming.
					await new Promise(resolve => setTimeout(resolve, 500));
				}
			}
		} finally {
			this.isProcessingQueue = false;
		}
	}

	/**
	 * Updates notification settings.
	 */
        updateSettings(enableNotifications: boolean, enableProgressBar: boolean): void {
                this.enableNotifications = enableNotifications;
                this.enableProgressBar = enableProgressBar;
                if (!enableProgressBar) {
                        this.destroyEntityPreviewPanel();
                        this.fixedProgressBar = null;
                }
        }

	/**
	 * Clears all notifications.
	 */
        clear(): void {
                this.notificationQueue = [];
                this.clearEntityPreview();
        }

        clearEntityPreview(): void {
                if (this.entityPreviewList) {
                        this.entityPreviewList.innerHTML = '';
                }
if (this.entityPreviewRelations) {
this.entityPreviewRelations.textContent = '';
}
this.entityPreviewNotePath = null;
if (this.entityPreviewAction) {
this.entityPreviewAction.disabled = true;
this.entityPreviewAction.textContent = 'Open note';
this.entityPreviewAction.removeAttribute('aria-label');
}
}

private ensureEntityPreviewPanel(): void {
if (this.entityPreviewPanel) return;
const panel = document.createElement('div');
panel.addClass('obsidian-rag-entity-preview');
const meta = document.createElement('div');
meta.addClass('obsidian-rag-entity-preview__meta');
const list = document.createElement('ul');
list.addClass('obsidian-rag-entity-preview__list');
const relations = document.createElement('div');
relations.addClass('obsidian-rag-entity-preview__relations');
const actions = document.createElement('div');
actions.addClass('obsidian-rag-entity-preview__actions');
const openButton = document.createElement('button');
openButton.addClass('obsidian-rag-entity-preview__action');
openButton.type = 'button';
openButton.textContent = 'Open note';
openButton.disabled = true;
openButton.addEventListener('click', (event) => {
event.preventDefault();
event.stopPropagation();
this.openPreviewNote();
});
actions.appendChild(openButton);
panel.appendChild(meta);
panel.appendChild(list);
panel.appendChild(relations);
panel.appendChild(actions);
this.statusBarItem.appendChild(panel);
this.entityPreviewPanel = panel;
this.entityPreviewList = list;
this.entityPreviewMeta = meta;
this.entityPreviewRelations = relations;
this.entityPreviewAction = openButton;
}

private destroyEntityPreviewPanel(): void {
                if (this.entityPreviewPanel?.parentElement) {
                        this.entityPreviewPanel.parentElement.removeChild(this.entityPreviewPanel);
                }
this.entityPreviewPanel = null;
this.entityPreviewList = null;
this.entityPreviewMeta = null;
this.entityPreviewRelations = null;
this.entityPreviewAction = null;
this.entityPreviewNotePath = null;
}

private async openPreviewNote(): Promise<void> {
if (!this.entityPreviewNotePath) return;
const file = this.app.vault.getAbstractFileByPath(this.entityPreviewNotePath);
if (file && file instanceof TFile) {
await this.app.workspace.openLinkText(this.entityPreviewNotePath, '', false);
return;
}
new Notice('Unable to locate note for the entity preview.');
}
}
