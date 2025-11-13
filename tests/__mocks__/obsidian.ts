export const parseYaml = (yaml: string): Record<string, any> => {
        const result: Record<string, any> = {};
        yaml.split('\n').forEach(line => {
                const [rawKey, ...rest] = line.split(':');
                if (!rawKey) {
                        return;
                }
                const key = rawKey.trim();
                const value = rest.join(':').trim();
                if (value === '') {
                        result[key] = null;
                } else if (value.startsWith('[') && value.endsWith(']')) {
                        try {
                                result[key] = JSON.parse(value.replace(/'/g, '"'));
                        } catch (error) {
                                result[key] = value;
                        }
                } else {
                        result[key] = value;
                }
        });
        return result;
};

export const stringifyYaml = (_data: unknown): string => '';
export const Notice = jest.fn();

const deriveExtension = (path: string): string => {
        const baseName = path.split('/').pop() ?? path;
        const dotIndex = baseName.lastIndexOf('.');
        return dotIndex >= 0 ? baseName.slice(dotIndex + 1) : '';
};

export class TFile {
        path: string;
        name: string;
        basename: string;
        extension: string;
        stat: { ctime: number; mtime: number; size: number };
        vault?: Vault;

        constructor(path: string) {
                this.path = path;
                this.basename = path.split('/').pop() ?? path;
                this.name = this.basename;
                this.extension = deriveExtension(path);
                const timestamp = Date.now();
                this.stat = { ctime: timestamp, mtime: timestamp, size: 0 };
        }
}

type StoredFile = { file: TFile; content: string };

export class Vault {
        private files: Map<string, StoredFile> = new Map();

        constructor(initialFiles: Record<string, string> = {}) {
                Object.entries(initialFiles).forEach(([path, content]) => {
                        this.__createFile(path, content);
                });
        }

        public __createFile(path: string, content: string = ''): TFile {
                const file = new TFile(path);
                file.vault = this;
                file.stat.size = content.length;
                file.stat.mtime = Date.now();
                if (!file.stat.ctime) {
                        file.stat.ctime = file.stat.mtime;
                }
                this.files.set(path, { file, content });
                return file;
        }

        public __setFileContents(path: string, content: string): void {
                const entry = this.files.get(path);
                if (!entry) {
                        this.__createFile(path, content);
                        return;
                }
                entry.content = content;
                entry.file.stat.size = content.length;
                entry.file.stat.mtime = Date.now();
        }

        public getAbstractFileByPath(path: string): TFile | null {
                return this.files.get(path)?.file ?? null;
        }

        public async read(fileOrPath: TFile | string): Promise<string> {
                const path = typeof fileOrPath === 'string' ? fileOrPath : fileOrPath.path;
                return this.files.get(path)?.content ?? '';
        }
}
