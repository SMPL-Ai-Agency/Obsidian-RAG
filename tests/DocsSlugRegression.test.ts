import fs from 'node:fs';
import path from 'node:path';

describe('Documentation regression: legacy org slug', () => {
    const rootDir = path.resolve(__dirname, '..');
    const legacySlug = 'smpl-ai-automations';
    const ignoredDirs = new Set([
        'node_modules',
        '.git',
        '.yarn',
        'release',
        'dist'
    ]);

    const trackedFiles: string[] = [];
    const allowedExtensions = new Set(['.md', '.mdx', '.markdown']);

    function walk(currentPath: string) {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            if (ignoredDirs.has(entry.name)) {
                continue;
            }

            const fullPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (allowedExtensions.has(ext)) {
                    trackedFiles.push(fullPath);
                }
            }
        }
    }

    walk(rootDir);

    it('does not contain references to the deprecated GitHub organization slug', () => {
        const offenders: string[] = [];

        for (const filePath of trackedFiles) {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (content.toLowerCase().includes(legacySlug)) {
                offenders.push(path.relative(rootDir, filePath));
            }
        }

        if (offenders.length) {
            throw new Error(`Legacy slug found in: ${offenders.join(', ')}`);
        }
    });
});
