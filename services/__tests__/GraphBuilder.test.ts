import { GraphBuilder } from '../GraphBuilder';
import { MetadataExtractor } from '../MetadataExtractor';
import { SupabaseService } from '../SupabaseService';
import { Neo4jService } from '../Neo4jService';
import { EmbeddingService } from '../EmbeddingService';
import { DocumentMetadata } from '../../models/DocumentChunk';

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
                const builder = new GraphBuilder({
                        metadataExtractor,
                        supabaseService,
                        neo4jService,
                        embeddingService,
                        errorHandler: { handleError: jest.fn() } as any,
                        config: {
                                enableAdvancedEntities: overrides.enabled ?? true,
                                entityTypes: ['person'],
                                customEntityRules: [],
                                maxGleaningIterations: 1,
                                projectName: 'test-project',
                        },
                });
                return { builder, metadataExtractor, supabaseService, neo4jService, embeddingService };
        };

        it('skips processing when feature disabled', async () => {
                const { builder, metadataExtractor } = buildBuilder({ enabled: false });
                await builder.processNote('Hello world', baseMetadata);
                expect((metadataExtractor.extractEntitiesAdvanced as jest.Mock)).not.toHaveBeenCalled();
        });

        it('upserts entities and relationships', async () => {
                const { builder, metadataExtractor, supabaseService, neo4jService, embeddingService } = buildBuilder();
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
                expect(neo4jService.upsertAdvancedEntities as jest.Mock).toHaveBeenCalledWith(
                        baseMetadata.path,
                        expect.any(Array),
                        expect.any(Array)
                );
        });
});
