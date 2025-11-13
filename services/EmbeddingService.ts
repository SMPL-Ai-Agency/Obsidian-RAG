import OpenAI from 'openai';
import { Notice } from 'obsidian';
import { EmbeddingResponse } from '../models/DocumentChunk';
import { ErrorHandler } from '../utils/ErrorHandler';
import { EmbeddingProviderSettings, DEFAULT_OPENAI_SETTINGS } from '../settings/Settings';

interface StorageLike {
        getItem(key: string): string | null;
        setItem(key: string, value: string): void;
        removeItem(key: string): void;
}

interface CachedEmbeddingRecord {
        vector: number[];
        timestamp: number;
}

export class EmbeddingService {
        private openAIClient: OpenAI | null = null;
        private rateLimitDelay = 20; // ms between requests
        private lastRequestTime = 0;
        private readonly errorHandler: ErrorHandler;
        private settings: EmbeddingProviderSettings;
        private readonly targetVectorSize = 768;
        private missingOpenAINoticeShown = false;
        private llmModel: string;
        private embeddingCache: Map<string, CachedEmbeddingRecord> = new Map();
        private readonly cacheNamespace = 'obsidian-rag:embeddings';
        private readonly cacheIndexKey = `${this.cacheNamespace}:index`;
        private readonly cacheMaxEntries = 200;
        private readonly cacheTTL = 1000 * 60 * 60 * 24; // 24 hours
        private storage: StorageLike | null;
        private cacheIndex: string[] = [];

        constructor(settings: EmbeddingProviderSettings, errorHandler: ErrorHandler, llmModel?: string) {
                this.settings = settings;
                this.errorHandler = errorHandler;
                this.llmModel = llmModel?.trim() || 'llama3';
                this.storage = this.detectStorage();
                this.restoreCacheIndex();
                this.initializeOpenAIClient();
        }

        /**
         * Check if any embedding provider is available.
         */
        public isInitialized(): boolean {
                return (this.settings.ollama?.enabled ?? false) || this.openAIClient !== null;
        }

        /**
         * Updates provider settings and refreshes OpenAI client state.
         */
        public updateSettings(settings: EmbeddingProviderSettings, llmModel?: string): void {
                this.settings = settings;
                if (llmModel) {
                        this.llmModel = llmModel;
                }
                this.initializeOpenAIClient();
                this.missingOpenAINoticeShown = false;
        }

        /**
         * Updates the dedicated LLM model used for generative prompts.
         */
        public updateLLMModel(model?: string): void {
                if (model && model.trim().length > 0) {
                        this.llmModel = model.trim();
                }
        }

        /**
         * Allows tuning the delay between OpenAI requests.
         */
        public updateRateLimit(delayMs: number): void {
                this.rateLimitDelay = delayMs;
        }

        /**
         * Creates embeddings for the given text chunks, preferring Ollama before OpenAI.
         */
        async createEmbeddings(chunks: string[]): Promise<EmbeddingResponse[]> {
                const embeddings: EmbeddingResponse[] = [];

                for (let i = 0; i < chunks.length; i++) {
                        embeddings.push(await this.generateEmbeddingForChunk(chunks[i], i));
                }

                return embeddings;
        }

        private async generateEmbeddingForChunk(chunk: string, index: number): Promise<EmbeddingResponse> {
                const ollamaEnabled = this.settings.ollama?.enabled;
                const ollamaProviderKey = ollamaEnabled && this.settings.ollama?.model
                        ? this.buildProviderKey('ollama', this.settings.ollama.model)
                        : null;
                if (ollamaEnabled && ollamaProviderKey) {
                        const cached = this.getCachedEmbedding(chunk, ollamaProviderKey);
                        if (cached) {
                                return this.buildEmbeddingResponse(cached, index, ollamaProviderKey, {
                                        prompt_tokens: chunk.length,
                                        total_tokens: chunk.length,
                                });
                        }
                        try {
                                const { embedding, model } = await this.createOllamaEmbedding(chunk);
                                const providerModel = this.buildProviderKey('ollama', model);
                                this.persistEmbeddingToCache(chunk, providerModel, embedding);
                                return this.buildEmbeddingResponse(embedding, index, providerModel, {
                                        prompt_tokens: chunk.length,
                                        total_tokens: chunk.length,
                                });
                        } catch (error) {
                                this.handleEmbeddingError(error, chunk, 'ollama');
                                if (!this.settings.ollama.fallbackToOpenAI) {
                                        return this.emptyEmbeddingResponse(index, `ollama:${this.settings.ollama.model}`);
                                }
                        }
                }

                if (this.openAIClient) {
                        const openAIModel = this.getOpenAIModel();
                        const providerKey = this.buildProviderKey('openai', openAIModel);
                        const cached = this.getCachedEmbedding(chunk, providerKey);
                        if (cached) {
                                return this.buildEmbeddingResponse(cached, index, openAIModel, {
                                        prompt_tokens: chunk.length,
                                        total_tokens: chunk.length,
                                });
                        }
                        try {
                                const result = await this.createOpenAIEmbedding(chunk, openAIModel);
                                const responseModel = this.buildProviderKey('openai', result.model);
                                this.persistEmbeddingToCache(chunk, responseModel, result.embedding);
                                return this.buildEmbeddingResponse(result.embedding, index, responseModel, {
                                        prompt_tokens: result.usage.prompt_tokens,
                                        total_tokens: result.usage.total_tokens,
                                });
                        } catch (error) {
                                this.handleEmbeddingError(error, chunk, 'openai');
                        }
                } else if (!ollamaEnabled || this.settings.ollama.fallbackToOpenAI) {
                        if (!this.missingOpenAINoticeShown) {
                                new Notice('OpenAI API key is missing. Please set it in the plugin settings.');
                                this.missingOpenAINoticeShown = true;
                        }
                }

                const fallbackModel = ollamaEnabled ? `ollama:${this.settings.ollama.model}` : this.getOpenAIModel();
                return this.emptyEmbeddingResponse(index, fallbackModel);
        }

        private async createOllamaEmbedding(input: string): Promise<{ embedding: number[]; model: string }> {
                const { url, model } = this.settings.ollama;
                if (!url) {
                        throw new Error('Ollama URL is not configured.');
                }
                if (!model) {
                        throw new Error('Ollama model is not configured.');
                }

                const normalizedUrl = url.replace(/\/+$/, '');
                const response = await fetch(`${normalizedUrl}/api/embeddings`, {
                        method: 'POST',
                        headers: {
                                'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                                model,
                                prompt: input,
                        }),
                });

                if (!response.ok) {
                        throw new Error(`Ollama responded with status ${response.status}`);
                }

                const data = await response.json();
                if (!data || !Array.isArray(data.embedding)) {
                        throw new Error('Unexpected response structure from Ollama.');
                }

                const normalizedEmbedding = this.ensureVectorSize(data.embedding);
                const modelName = typeof data.model === 'string' ? data.model : model;

                return {
                        embedding: normalizedEmbedding,
                        model: modelName,
                };
        }

        private async createOpenAIEmbedding(chunk: string, modelOverride?: string): Promise<{
                embedding: number[];
                model: string;
                usage: { prompt_tokens: number; total_tokens: number };
        }> {
                await this.applyOpenAIRateLimit();

                const model = modelOverride || this.getOpenAIModel();
                const response = await this.openAIClient!.embeddings.create({
                        model,
                        input: chunk,
                        encoding_format: 'float',
                });

                this.lastRequestTime = Date.now();

                const embedding = response.data?.[0]?.embedding ?? [];
                const normalizedEmbedding = this.ensureVectorSize(embedding);

                return {
                        embedding: normalizedEmbedding,
                        model: response.model ?? model,
                        usage: {
                                prompt_tokens: response.usage?.prompt_tokens ?? 0,
                                total_tokens: response.usage?.total_tokens ?? 0,
                        },
                };
        }

        /**
         * Convenience helper for callers that only need a single embedding vector.
         */
        public async generateEmbedding(input: string): Promise<number[]> {
                const response = await this.generateEmbeddingForChunk(input, 0);
                return response.data?.[0]?.embedding ?? [];
        }

        /**
         * Issues a general LLM prompt using Ollama when available, falling back to OpenAI.
         */
        public async generateLLMResponse(prompt: string, model: string = this.llmModel): Promise<string> {
                if (this.settings.ollama?.enabled) {
                        try {
                                return await this.callOllamaLLM(prompt, model);
                        } catch (error) {
                                this.handleEmbeddingError(error, prompt.substring(0, 120), 'ollama');
                                if (!this.settings.ollama.fallbackToOpenAI) {
                                        throw error;
                                }
                        }
                }

                if (this.openAIClient) {
                        return await this.callOpenAILLM(prompt, model);
                }

                throw new Error('No LLM provider is configured for generateLLMResponse');
        }

        private async callOllamaLLM(prompt: string, model?: string): Promise<string> {
                const targetModel = model?.trim() || this.llmModel;
                const { url } = this.settings.ollama;
                if (!url) {
                        throw new Error('Ollama URL is not configured.');
                }
                const normalizedUrl = url.replace(/\/+$/, '');
                const response = await fetch(`${normalizedUrl}/api/generate`, {
                        method: 'POST',
                        headers: {
                                'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                                model: targetModel,
                                prompt,
                                stream: false,
                        }),
                });
                if (!response.ok) {
                        throw new Error(`Ollama responded with status ${response.status}`);
                }
                const data = await response.json();
                if (typeof data?.response !== 'string') {
                        throw new Error('Unexpected response structure from Ollama generate API');
                }
                return data.response;
        }

        private async callOpenAILLM(prompt: string, model?: string): Promise<string> {
                if (!this.openAIClient) {
                        throw new Error('OpenAI client is not initialized.');
                }
                const targetModel = model?.trim() && !model.toLowerCase().includes('embedding')
                        ? model
                        : 'gpt-4o-mini';
                const response = await this.openAIClient.chat.completions.create({
                        model: targetModel,
                        messages: [
                                { role: 'system', content: 'You are a focused assistant that responds only with JSON when asked.' },
                                { role: 'user', content: prompt },
                        ],
                });
                return response.choices?.[0]?.message?.content || '';
        }

        private async applyOpenAIRateLimit(): Promise<void> {
                const timeSinceLastRequest = Date.now() - this.lastRequestTime;
                if (timeSinceLastRequest < this.rateLimitDelay) {
                        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
                }
        }

        private buildEmbeddingResponse(
                embedding: number[],
                index: number,
                model: string,
                usage?: { prompt_tokens?: number; total_tokens?: number }
        ): EmbeddingResponse {
                return {
                        data: [
                                {
                                        embedding,
                                        index,
                                },
                        ],
                        usage: {
                                prompt_tokens: usage?.prompt_tokens ?? 0,
                                total_tokens: usage?.total_tokens ?? 0,
                        },
                        model,
                };
        }

        private emptyEmbeddingResponse(index: number, model: string): EmbeddingResponse {
                return {
                        data: [],
                        usage: { prompt_tokens: 0, total_tokens: 0 },
                        model,
                };
        }

        private ensureVectorSize(vector: number[]): number[] {
                if (vector.length === this.targetVectorSize) {
                        return vector;
                }
                if (vector.length > this.targetVectorSize) {
                        return vector.slice(0, this.targetVectorSize);
                }

                const padded = new Array(this.targetVectorSize).fill(0);
                for (let i = 0; i < vector.length; i++) {
                        padded[i] = vector[i];
                }
                return padded;
        }

        private initializeOpenAIClient(): void {
                const apiKey = this.settings.openai?.apiKey;
                if (!apiKey) {
                        this.openAIClient = null;
                        return;
                }

                this.openAIClient = new OpenAI({
                        apiKey,
                        dangerouslyAllowBrowser: true,
                });
        }

        private getOpenAIModel(): string {
                return this.settings.openai?.model || DEFAULT_OPENAI_SETTINGS.model;
        }

        private handleEmbeddingError(error: any, chunk: string, provider: 'ollama' | 'openai'): void {
                const message = error instanceof Error ? error.message : String(error);
                const noticeMessage = provider === 'ollama'
                        ? `Ollama embedding error: ${message}`
                        : `OpenAI embedding error: ${message}`;

                this.errorHandler.handleError(error, {
                        context: `EmbeddingService.${provider}`,
                        metadata: {
                                provider,
                                chunkPreview: chunk.substring(0, 100) + '...',
                        },
                });

                new Notice(noticeMessage);
        }

        private detectStorage(): StorageLike | null {
                if (typeof window !== 'undefined' && window.localStorage) {
                        return window.localStorage;
                }
                if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
                        return (globalThis as any).localStorage as StorageLike;
                }
                return null;
        }

        private restoreCacheIndex(): void {
                if (!this.storage) return;
                try {
                        const raw = this.storage.getItem(this.cacheIndexKey);
                        if (!raw) return;
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) {
                                this.cacheIndex = parsed.filter((entry): entry is string => typeof entry === 'string');
                        }
                } catch (error) {
                        console.warn('Failed to hydrate embedding cache index', error);
                        this.cacheIndex = [];
                }
        }

        private getCachedEmbedding(text: string, provider: string | null): number[] | null {
                if (!provider) return null;
                const key = this.getCacheKey(text, provider);
                const record = this.embeddingCache.get(key) ?? this.readCacheRecord(key);
                if (!record) return null;
                const isExpired = Date.now() - record.timestamp > this.cacheTTL;
                if (isExpired) {
                        this.removeCacheEntry(key);
                        this.cacheIndex = this.cacheIndex.filter(entry => entry !== key);
                        this.persistCacheIndex();
                        return null;
                }
                return record.vector;
        }

        private persistEmbeddingToCache(text: string, provider: string, vector: number[]): void {
                const key = this.getCacheKey(text, provider);
                const record: CachedEmbeddingRecord = { vector, timestamp: Date.now() };
                this.embeddingCache.set(key, record);
                this.cacheIndex = this.cacheIndex.filter(entry => entry !== key);
                this.cacheIndex.push(key);
                this.pruneCacheIfNeeded();
                if (this.storage) {
                        try {
                                this.storage.setItem(key, JSON.stringify(record));
                        } catch (error) {
                                console.warn('Failed to persist embedding cache entry', error);
                        }
                        this.persistCacheIndex();
                }
        }

        private readCacheRecord(key: string): CachedEmbeddingRecord | null {
                if (!this.storage) return null;
                try {
                        const raw = this.storage.getItem(key);
                        if (!raw) return null;
                        const parsed = JSON.parse(raw) as Partial<CachedEmbeddingRecord>;
                        if (parsed && Array.isArray(parsed.vector) && typeof parsed.timestamp === 'number') {
                                const record: CachedEmbeddingRecord = {
                                        vector: parsed.vector,
                                        timestamp: parsed.timestamp,
                                };
                                this.embeddingCache.set(key, record);
                                return record;
                        }
                } catch (error) {
                        console.warn('Failed to read embedding cache entry', error);
                }
                return null;
        }

        private pruneCacheIfNeeded(): void {
                while (this.cacheIndex.length > this.cacheMaxEntries) {
                        const oldest = this.cacheIndex.shift();
                        if (oldest) {
                                this.removeCacheEntry(oldest);
                        }
                }
                this.persistCacheIndex();
        }

        private removeCacheEntry(key: string): void {
                this.embeddingCache.delete(key);
                if (this.storage) {
                        try {
                                this.storage.removeItem(key);
                        } catch (error) {
                                console.warn('Failed to remove embedding cache entry', error);
                        }
                }
        }

        private getCacheKey(text: string, provider: string): string {
                return `${this.cacheNamespace}:${provider}:${this.simpleHash(text)}`;
        }

        private buildProviderKey(provider: 'ollama' | 'openai', model: string): string {
                return `${provider}:${model}`;
        }

        private simpleHash(input: string): string {
                let hash = 0;
                for (let i = 0; i < input.length; i++) {
                        hash = (hash << 5) - hash + input.charCodeAt(i);
                        hash |= 0;
                }
                return hash.toString(16);
        }

        private persistCacheIndex(): void {
                if (!this.storage) return;
                try {
                        this.storage.setItem(this.cacheIndexKey, JSON.stringify(this.cacheIndex));
                } catch (error) {
                        console.warn('Failed to persist embedding cache index', error);
                }
        }
}
