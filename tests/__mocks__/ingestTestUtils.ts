import { Vault } from 'obsidian';
import { DocumentMetadata } from '../../models/DocumentChunk';
import { ProcessingTask, TaskStatus, TaskType } from '../../models/ProcessingTask';

export const FIXED_TIMESTAMP = 1_700_000_000_000;

export const createDocumentMetadata = (
        path: string,
        overrides: Partial<DocumentMetadata> = {}
): DocumentMetadata => ({
        obsidianId: overrides.obsidianId ?? path,
        path: overrides.path ?? path,
        lastModified: overrides.lastModified ?? FIXED_TIMESTAMP,
        created: overrides.created ?? FIXED_TIMESTAMP,
        size: overrides.size ?? 1024,
        tags: overrides.tags ?? [],
        aliases: overrides.aliases ?? [],
        links: overrides.links ?? [],
        customMetadata: overrides.customMetadata ?? {},
        ...overrides
});

type VaultWithFactory = Vault & { __createFile?: (path: string, content: string) => void };

export const seedVaultWithNote = (vault: Vault, path: string, content: string): void => {
        const mockVault = vault as VaultWithFactory;
        if (typeof mockVault.__createFile !== 'function') {
                throw new Error('The provided vault mock does not expose __createFile');
        }
        mockVault.__createFile(path, content);
};

export const buildVaultWithDocument = (
        path: string,
        content: string,
        overrides?: Partial<DocumentMetadata>
): { vault: Vault; metadata: DocumentMetadata } => {
        const vault = new Vault();
        seedVaultWithNote(vault, path, content);
        const metadata = createDocumentMetadata(path, { size: content.length, ...overrides });
        return { vault, metadata };
};

export const createProcessingTask = (
        metadata: DocumentMetadata,
        overrides: Partial<ProcessingTask> = {}
): ProcessingTask => ({
        id: overrides.id ?? metadata.obsidianId,
        type: overrides.type ?? TaskType.CREATE,
        status: overrides.status ?? TaskStatus.PENDING,
        priority: overrides.priority ?? 1,
        maxRetries: overrides.maxRetries ?? 3,
        retryCount: overrides.retryCount ?? 0,
        createdAt: overrides.createdAt ?? FIXED_TIMESTAMP,
        updatedAt: overrides.updatedAt ?? FIXED_TIMESTAMP,
        metadata,
        data: overrides.data ?? {}
});
