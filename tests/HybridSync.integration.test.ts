import { EmbeddingService } from '../services/EmbeddingService';
import { HybridRAGService } from '../services/HybridRAGService';
import { EntityExtractor } from '../services/EntityExtractor';
import { DEFAULT_EMBEDDING_PROVIDER_SETTINGS, EmbeddingProviderSettings } from '../settings/Settings';
import { ErrorHandler } from '../utils/ErrorHandler';
import { DocumentMetadata } from '../models/DocumentChunk';

describe('Hybrid sync integration', () => {
        const baseSettings: EmbeddingProviderSettings = {
                ...DEFAULT_EMBEDDING_PROVIDER_SETTINGS,
                ollama: {
                        enabled: true,
                        url: 'http://localhost:11434',
                        model: 'nomic-embed-text',
                        fallbackToOpenAI: false,
                },
                openai: {
                        apiKey: '',
                        model: 'text-embedding-3-small',
                        maxTokens: 0,
                        temperature: 0,
                },
        };

        const mockFetch = jest.fn(async (input: any) => {
                if (typeof input === 'string' && input.endsWith('/api/embeddings')) {
                        return {
                                ok: true,
                                status: 200,
                                json: async () => ({
                                        embedding: Array(5).fill(0).map((_, index) => index),
                                        model: 'nomic-embed-text',
                                }),
                        } as Response;
                }
                if (typeof input === 'string' && input.endsWith('/api/generate')) {
                        return {
                                ok: true,
                                status: 200,
                                json: async () => ({
                                        response: JSON.stringify({
                                                entities: [
                                                        { id: 'entity-1', name: 'Sample', type: 'Concept', summary: 'example' },
                                                ],
                                                relationships: [
                                                        { sourceId: 'entity-1', targetId: 'entity-1', type: 'related_to' },
                                                ],
                                        }),
                                }),
                        } as Response;
                }
                throw new Error(`Unhandled fetch request: ${input}`);
        });

        beforeEach(() => {
            (global as any).fetch = mockFetch;
            mockFetch.mockClear();
        });

        it('runs vector and graph stages while reusing cached embeddings in hybrid mode', async () => {
                const errorHandler = new ErrorHandler({ enableDebugLogs: false, logLevel: 'error', logToFile: false });
                const embeddingService = new EmbeddingService(baseSettings, errorHandler, 'llama3');
                const entityExtractor = new EntityExtractor(baseSettings, errorHandler, 'test-project');
                const hybridService = new HybridRAGService();
                const metadata: DocumentMetadata = {
                        obsidianId: 'meta-1',
                        path: 'Test.md',
                        lastModified: Date.now(),
                        created: Date.now(),
                        size: 100,
                };

                const vectorStage = async () => {
                        await embeddingService.createEmbeddings(['Chunk body']);
                };
                const graphStage = async () => {
                        const result = await entityExtractor.extractFromDocument('Document content', metadata);
                        expect(result?.entities).toHaveLength(1);
                        expect(result?.relationships).toHaveLength(1);
                };

                await hybridService.execute({ mode: 'hybrid', vectorStage, graphStage });
                await hybridService.execute({ mode: 'hybrid', vectorStage, graphStage });

                const embeddingCalls = mockFetch.mock.calls.filter(([url]) => typeof url === 'string' && url.includes('/api/embeddings'));
                const entityCalls = mockFetch.mock.calls.filter(([url]) => typeof url === 'string' && url.includes('/api/generate'));

                expect(embeddingCalls.length).toBe(1);
                expect(entityCalls.length).toBe(2);
        });
});
