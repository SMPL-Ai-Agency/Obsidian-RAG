import { GraphBuilder } from '../services/GraphBuilder';
import type { MetadataExtractor } from '../services/MetadataExtractor';
import type { SupabaseService } from '../services/SupabaseService';
import type { Neo4jService } from '../services/Neo4jService';
import type { EmbeddingService } from '../services/EmbeddingService';
import type { NotificationManager } from '../utils/NotificationManager';
import type { ErrorHandler } from '../utils/ErrorHandler';
import { DocumentMetadata } from '../models/DocumentChunk';

describe('GraphBuilder', () => {
        const baseMetadata: DocumentMetadata = {
                obsidianId: 'example.md',
                path: 'example.md',
                created: Date.now(),
                lastModified: Date.now(),
                size: 10,
                frontMatter: {},
                tags: [],
                links: [],
                customMetadata: {},
        };

        const buildBuilder = (overrides: Partial<{ enabled: boolean }> = {}) => {
                const metadataExtractor = {
                        extractEntitiesAdvanced: jest.fn().mockResolvedValue([]),
                } as unknown as MetadataExtractor;
                const supabaseService = {
                        upsertEntityRecord: jest.fn().mockResolvedValue(undefined),
                } as unknown as SupabaseService;
                const neo4jService = {
                        upsertAdvancedEntities: jest.fn().mockResolvedValue(undefined),
                } as unknown as Neo4jService;
                const embeddingService = {
                        generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2]),
                        generateLLMResponse: jest.fn().mockResolvedValue('[]'),
                } as unknown as EmbeddingService;
                const notificationManager = {
                        updateEntityPreview: jest.fn(),
                        clearEntityPreview: jest.fn(),
                } as unknown as NotificationManager;
                const errorHandler = { handleError: jest.fn() } as unknown as ErrorHandler;
                const builder = new GraphBuilder({
                        metadataExtractor,
                        supabaseService,
                        neo4jService,
                        embeddingService,
                        errorHandler,
                        notificationManager,
                        config: {
                                enableAdvancedEntities: overrides.enabled ?? true,
                                entityTypes: ['person'],
                                customEntityRules: [],
                                maxGleaningIterations: 1,
                                projectName: 'test-project',
                        },
                });
                return { builder, metadataExtractor, supabaseService, neo4jService, embeddingService, notificationManager, errorHandler };
        };

        it('skips processing when feature disabled', async () => {
                const { builder, metadataExtractor, notificationManager } = buildBuilder({ enabled: false });
                await builder.processNote('Hello world', baseMetadata);
                expect((metadataExtractor.extractEntitiesAdvanced as jest.Mock)).not.toHaveBeenCalled();
                expect((notificationManager.clearEntityPreview as jest.Mock)).toHaveBeenCalled();
        });

        it('upserts entities and relationships', async () => {
                const { builder, metadataExtractor, supabaseService, neo4jService, embeddingService, notificationManager } = buildBuilder();
                (metadataExtractor.extractEntitiesAdvanced as jest.Mock).mockResolvedValue([
                        { name: 'Ada Lovelace', type: 'person', description: 'Mathematician' },
                        { name: 'Analytical Engine', type: 'artifact', description: 'Mechanical computer' },
                ]);
                (embeddingService.generateLLMResponse as jest.Mock).mockResolvedValue(
                        JSON.stringify([
                                {
                                        src: 'Ada Lovelace',
                                        tgt: 'Analytical Engine',
                                        description: 'designed for',
                                        keywords: ['invention'],
                                        weight: 0.9,
                                },
                        ])
                );

                await builder.processNote('Ada helped envision the Analytical Engine.', baseMetadata);

                expect(supabaseService.upsertEntityRecord as jest.Mock).toHaveBeenCalledTimes(2);
                const relationshipsArg = (neo4jService.upsertAdvancedEntities as jest.Mock).mock.calls[0][2];
                expect(relationshipsArg).toHaveLength(1);
                expect(notificationManager.updateEntityPreview as jest.Mock).toHaveBeenCalledWith(
                        expect.objectContaining({ notePath: baseMetadata.path, entities: expect.any(Array) })
                );
        });

        it('filters out low confidence relationships', async () => {
                const { builder, metadataExtractor, neo4jService, embeddingService } = buildBuilder();
                (metadataExtractor.extractEntitiesAdvanced as jest.Mock).mockResolvedValue([
                        { name: 'Ada Lovelace', type: 'person', description: 'Mathematician' },
                        { name: 'Charles Babbage', type: 'person', description: 'Inventor' },
                ]);
                (embeddingService.generateLLMResponse as jest.Mock).mockResolvedValue(
                        JSON.stringify([
                                { src: 'Ada Lovelace', tgt: 'Charles Babbage', description: 'collaborated', weight: 0.9 },
                                { src: 'Ada Lovelace', tgt: 'Charles Babbage', description: 'met once', weight: 0.1 },
                        ])
                );
                await builder.processNote('content', baseMetadata);
                const [, , relationships] = (neo4jService.upsertAdvancedEntities as jest.Mock).mock.calls[0];
                expect(relationships).toHaveLength(1);
                expect(relationships[0].description).toBe('collaborated');
        });

        it('handles malformed JSON responses gracefully', async () => {
                const { builder, metadataExtractor, neo4jService, embeddingService, errorHandler } = buildBuilder();
                (metadataExtractor.extractEntitiesAdvanced as jest.Mock).mockResolvedValue([
                        { name: 'Ada Lovelace', type: 'person', description: 'Mathematician' },
                        { name: 'Analytical Engine', type: 'artifact', description: 'Mechanical computer' },
                ]);
                (embeddingService.generateLLMResponse as jest.Mock).mockResolvedValue('not-json');
                await builder.processNote('Ada and Engine', baseMetadata);
                const relationships = (neo4jService.upsertAdvancedEntities as jest.Mock).mock.calls[0][2];
                expect(relationships).toEqual([]);
                expect((errorHandler.handleError as jest.Mock)).toHaveBeenCalledWith(
                        expect.any(Error),
                        expect.objectContaining({ context: 'GraphBuilder.inferRelationships' }),
                        'warn'
                );
        });
});
