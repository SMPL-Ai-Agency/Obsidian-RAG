import { MetadataExtractor } from './MetadataExtractor';
import { SupabaseService } from './SupabaseService';
import { Neo4jService } from './Neo4jService';
import { EmbeddingService } from './EmbeddingService';
import { ErrorHandler } from '../utils/ErrorHandler';
import { AdvancedEntityExtractionParams, CustomEntityRule, Entity } from '../models/Entity';
import { Relationship } from '../models/Relationship';
import { DocumentMetadata } from '../models/DocumentChunk';

export interface GraphBuilderConfig {
        enableAdvancedEntities: boolean;
        entityTypes: string[];
        customEntityRules: CustomEntityRule[];
        maxGleaningIterations: number;
        projectName: string;
}

interface GraphBuilderDependencies {
        metadataExtractor: MetadataExtractor;
        supabaseService: SupabaseService | null;
        neo4jService: Neo4jService | null;
        embeddingService: EmbeddingService | null;
        errorHandler: ErrorHandler;
        config: GraphBuilderConfig;
}

export class GraphBuilder {
        private metadataExtractor: MetadataExtractor;
        private supabaseService: SupabaseService | null;
        private neo4jService: Neo4jService | null;
        private embeddingService: EmbeddingService | null;
        private errorHandler: ErrorHandler;
        private config: GraphBuilderConfig;

        constructor(options: GraphBuilderDependencies) {
                this.metadataExtractor = options.metadataExtractor;
                this.supabaseService = options.supabaseService;
                this.neo4jService = options.neo4jService;
                this.embeddingService = options.embeddingService;
                this.errorHandler = options.errorHandler;
                this.config = options.config;
        }

        public updateConfig(config: Partial<GraphBuilderConfig>): void {
                this.config = { ...this.config, ...config };
        }

        public updateEmbeddingService(service: EmbeddingService | null): void {
                this.embeddingService = service;
        }

        public updateSupabaseService(service: SupabaseService | null): void {
                this.supabaseService = service;
        }

        public updateNeo4jService(service: Neo4jService | null): void {
                this.neo4jService = service;
        }

        public isEnabled(): boolean {
                return this.config.enableAdvancedEntities && !!this.embeddingService;
        }

        public async processNote(content: string, metadata: DocumentMetadata): Promise<void> {
                if (!this.isEnabled()) {
                        return;
                }
                const params: AdvancedEntityExtractionParams = {
                        text: content,
                        entityTypes: this.config.entityTypes,
                        customRules: this.config.customEntityRules,
                        maxGleaning: this.config.maxGleaningIterations,
                };
                const entities = await this.metadataExtractor.extractEntitiesAdvanced(params, this.embeddingService);
                if (!entities.length) {
                        return;
                }
                const relationships = await this.inferRelationships(entities, content);
                await this.persistEntities(metadata, entities, relationships);
        }

        private async inferRelationships(entities: Entity[], text: string): Promise<Relationship[]> {
                if (!this.embeddingService || entities.length < 2) {
                        return [];
                }
                const truncated = text.length > 4000 ? text.slice(0, 4000) : text;
                const prompt = `Entities: ${JSON.stringify(entities.map(entity => ({ name: entity.name, type: entity.type })))}.` +
                        `\nSource text: ${truncated}\nReturn JSON array with {"src":"","tgt":"","description":"","keywords":[],"weight":0.0}.`;
                try {
                        const response = await this.embeddingService.generateLLMResponse(prompt);
                        const parsed = JSON.parse(response.trim());
                        if (!Array.isArray(parsed)) {
                                return [];
                        }
                        const sanitized = parsed
                                .filter(rel => rel?.src && rel?.tgt)
                                .map(rel => ({
                                        src: String(rel.src),
                                        tgt: String(rel.tgt),
                                        description: rel.description ? String(rel.description) : '',
                                        keywords: Array.isArray(rel.keywords) ? rel.keywords.map((kw: any) => String(kw)) : [],
                                        weight: typeof rel.weight === 'number' ? rel.weight : 0.5,
                                }));
                        const map = new Map<string, Relationship>();
                        for (const rel of sanitized) {
                                const key = `${rel.src.toLowerCase()}::${rel.tgt.toLowerCase()}::${rel.description}`;
                                if (!map.has(key)) {
                                        map.set(key, rel);
                                }
                        }
                        return Array.from(map.values());
                } catch (error) {
                        this.errorHandler.handleError(error, { context: 'GraphBuilder.inferRelationships' }, 'warn');
                        return [];
                }
        }

        private async persistEntities(
                metadata: DocumentMetadata,
                entities: Entity[],
                relationships: Relationship[]
        ): Promise<void> {
                const noteId = metadata.obsidianId || metadata.path;
                if (!noteId) return;
                await Promise.all([
                        this.upsertVectorEntities(noteId, entities),
                        this.upsertGraphEntities(metadata.path || noteId, entities, relationships),
                ]);
        }

        private async upsertVectorEntities(noteId: string, entities: Entity[]): Promise<void> {
                if (!this.supabaseService || !this.embeddingService) {
                        return;
                }
                for (const entity of entities) {
                        try {
                                const embedding = await this.embeddingService.generateEmbedding(`${entity.name}: ${entity.description}`);
                                await this.supabaseService.upsertEntityRecord({
                                        project_name: this.config.projectName,
                                        note_id: noteId,
                                        name: entity.name,
                                        type: entity.type,
                                        description: entity.description,
                                        embedding,
                                });
                        } catch (error) {
                                this.errorHandler.handleError(error, {
                                        context: 'GraphBuilder.upsertVectorEntities',
                                        metadata: { entity: entity.name },
                                }, 'warn');
                        }
                }
        }

        private async upsertGraphEntities(
                notePath: string,
                entities: Entity[],
                relationships: Relationship[]
        ): Promise<void> {
                if (!this.neo4jService) {
                        return;
                }
                try {
                        await this.neo4jService.upsertAdvancedEntities(notePath, entities, relationships);
                } catch (error) {
                        this.errorHandler.handleError(error, { context: 'GraphBuilder.upsertGraphEntities' }, 'warn');
                }
        }
}
