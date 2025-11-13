import neo4j, { Driver, Session, ManagedTransaction } from 'neo4j-driver';
import { DocumentChunk, DocumentMetadata } from '../models/DocumentChunk';
import { ObsidianRAGSettings, Neo4jSettings } from '../settings/Settings';
import { EntityExtractionResult } from './EntityExtractor';
import { Entity as AdvancedEntity } from '../models/Entity';
import { Relationship as AdvancedRelationship } from '../models/Relationship';

export class Neo4jService {
        private static instance: Neo4jService | null = null;
        private driver: Driver;
        private projectName: string;
        private settings: Neo4jSettings;
        private readonly effectiveBatchSize: number;

        private constructor(settings: Neo4jSettings) {
                this.settings = settings;
                this.projectName = settings.projectName || 'obsidian-rag';
                this.driver = neo4j.driver(settings.url, neo4j.auth.basic(settings.username, settings.password));
                const batchCandidates: number[] = [];
                if (typeof settings.maxBatchSize === 'number') {
                        batchCandidates.push(settings.maxBatchSize);
                }
                if (typeof settings.neo4jBatchLimit === 'number') {
                        batchCandidates.push(settings.neo4jBatchLimit);
                }
                const selectedBatchSize =
                        batchCandidates.length > 0 ? Math.min(...batchCandidates) : 500;
                this.effectiveBatchSize = Math.min(Math.max(selectedBatchSize, 50), 2000);
        }

        public static async getInstance(settings: ObsidianRAGSettings): Promise<Neo4jService | null> {
                if (!settings.neo4j?.url || !settings.neo4j.username || !settings.neo4j.password) {
                        console.warn('Neo4j configuration is incomplete. Skipping graph service initialization.');
                        return null;
                }
                if (!Neo4jService.instance || Neo4jService.instance.requiresReinitialize(settings.neo4j)) {
                        await Neo4jService.instance?.close();
                        Neo4jService.instance = new Neo4jService(settings.neo4j);
                        await Neo4jService.instance.initializeSchema();
                }
                return Neo4jService.instance;
        }

        private requiresReinitialize(config: Neo4jSettings): boolean {
                return (
                        this.settings.url !== config.url ||
                        this.settings.username !== config.username ||
                        this.settings.password !== config.password ||
                        this.settings.database !== config.database ||
                        this.settings.projectName !== config.projectName
                );
        }

        private getSession(): Session {
                return this.driver.session({ database: this.settings.database || 'neo4j' });
        }

        private async initializeSchema(): Promise<void> {
                await this.runWrite('initializeSchema', async tx => {
                        await tx.run(
                                'CREATE CONSTRAINT document_project IF NOT EXISTS FOR (d:Document) REQUIRE (d.project_name, d.path) IS UNIQUE'
                        );
                        await tx.run(
                                'CREATE CONSTRAINT chunk_project IF NOT EXISTS FOR (c:Chunk) REQUIRE (c.project_name, c.chunk_id) IS UNIQUE'
                        );
                        await tx.run(
                                'CREATE CONSTRAINT entity_project IF NOT EXISTS FOR (e:Entity) REQUIRE (e.project_name, e.entity_id) IS UNIQUE'
                        );
                });
        }

        public async upsertDocumentGraph(
                metadata: DocumentMetadata,
                chunks: DocumentChunk[],
                extraction: EntityExtractionResult | null
        ): Promise<void> {
                const chunkPayload = chunks.map(chunk => ({
                        id: (chunk.metadata as any)?.graphChunkId || `${metadata.path}::${chunk.chunk_index}`,
                        chunkIndex: chunk.chunk_index,
                        content: chunk.content,
                        preview: chunk.content.substring(0, 280),
                }));
                const documentProperties = {
                        projectName: this.projectName,
                        path: metadata.path,
                        title: metadata.path.split('/').pop() || metadata.path,
                        lastModified: metadata.lastModified,
                        created: metadata.created,
                        tags: metadata.tags || [],
                        aliases: metadata.aliases || [],
                        links: metadata.links || [],
                        size: metadata.size ?? 0,
                };
                await this.runWrite('upsertDocumentGraph', async tx => {
                                await tx.run(
                                        `MERGE (doc:Document {project_name: $projectName, path: $path})
SET doc += {
        title: $title,
        last_modified: $lastModified,
        created: $created,
        tags: $tags,
        aliases: $aliases,
        links: $links,
        size: $size,
        updated_at: datetime()
}`,
                                        documentProperties
                                );
                                for (const chunkBatch of this.chunkItems(chunkPayload)) {
                                        if (!chunkBatch.length) continue;
                                        await tx.run(
                                                `MATCH (doc:Document {project_name: $projectName, path: $path})
WITH doc
UNWIND $chunks AS chunk
MERGE (c:Chunk {project_name: $projectName, chunk_id: chunk.id})
SET c += {
        content: chunk.content,
        preview: chunk.preview,
        chunk_index: chunk.chunkIndex,
        updated_at: datetime()
}
MERGE (doc)-[rel:HAS_CHUNK]->(c)
SET rel.chunk_index = chunk.chunkIndex`,
                                                { ...documentProperties, chunks: chunkBatch }
                                        );
                                }
                                await tx.run(
                                        `MATCH (doc:Document {project_name: $projectName, path: $path})-[:HAS_CHUNK]->(chunk:Chunk {project_name: $projectName})
WHERE NOT chunk.chunk_id IN $chunkIds
DETACH DELETE chunk`,
                                        { ...documentProperties, chunkIds: chunkPayload.map(chunk => chunk.id) }
                                );
                                if (extraction?.entities?.length) {
                                        const entities = extraction.entities.map(entity => ({
                                                id: entity.id,
                                                name: entity.name,
                                                type: entity.type || 'Concept',
                                                summary: entity.summary || '',
                                                sourcePath: entity.sourcePath || metadata.path,
                                                importance: entity.importance ?? 1,
                                        }));
                                        for (const entityBatch of this.chunkItems(entities)) {
                                                if (!entityBatch.length) continue;
                                                await tx.run(
                                                        `UNWIND $entities AS entity
MERGE (e:Entity {project_name: $projectName, entity_id: entity.id})
SET e += {
        name: entity.name,
        type: entity.type,
        summary: entity.summary,
        source_path: entity.sourcePath,
        importance: entity.importance,
        updated_at: datetime()
}`,
                                                        { projectName: this.projectName, entities: entityBatch }
                                                );
                                                await tx.run(
                                                        `MATCH (doc:Document {project_name: $projectName, path: $path})
WITH doc
UNWIND $entities AS entity
MATCH (e:Entity {project_name: $projectName, entity_id: entity.id})
MERGE (doc)-[rel:MENTIONS]->(e)
SET rel.updated_at = datetime(), rel.weight = entity.importance`,
                                                        { ...documentProperties, entities: entityBatch }
                                                );
                                        }
                                }
                                if (extraction?.relationships?.length) {
                                        const relationships = extraction.relationships.map(rel => ({
                                                sourceId: rel.sourceId,
                                                targetId: rel.targetId,
                                                type: rel.type || 'related_to',
                                                description: rel.description || '',
                                        }));
                                        for (const relationshipBatch of this.chunkItems(relationships)) {
                                                if (!relationshipBatch.length) continue;
                                                await tx.run(
                                                        `UNWIND $relationships AS relationship
MATCH (source:Entity {project_name: $projectName, entity_id: relationship.sourceId})
MATCH (target:Entity {project_name: $projectName, entity_id: relationship.targetId})
MERGE (source)-[rel:RELATES_TO {project_name: $projectName, type: relationship.type}]->(target)
SET rel.description = relationship.description,
    rel.updated_at = datetime()`,
                                                        { projectName: this.projectName, relationships: relationshipBatch }
                                                );
                                        }
                                }
                        });
        }

        public async deleteDocument(path: string): Promise<void> {
                await this.runWrite('deleteDocument', tx =>
                                tx.run(
                                        `MATCH (doc:Document {project_name: $projectName, path: $path})
OPTIONAL MATCH (doc)-[:HAS_CHUNK]->(chunk:Chunk {project_name: $projectName})
WITH doc, collect(chunk) AS chunks
FOREACH (c IN chunks | DETACH DELETE c)
DETACH DELETE doc`,
                                        { projectName: this.projectName, path }
                                )
                        );
        }

        public async close(): Promise<void> {
                await this.driver?.close();
        }

        public async upsertAdvancedEntities(
                notePath: string,
                entities: AdvancedEntity[],
                relationships: AdvancedRelationship[]
        ): Promise<void> {
                if (!entities.length && !relationships.length) {
                        return;
                }
                await this.runWrite('upsertAdvancedEntities', async tx => {
                        await this.mergeDocumentShell(tx, notePath);
                        if (entities.length) {
                                await this.mergeAdvancedEntities(tx, notePath, entities);
                        }
                        if (relationships.length) {
                                await this.mergeAdvancedRelationships(tx, relationships);
                        }
                });
        }

        public async batchUpsertAdvancedEntities(
                payloads: { notePath: string; entities: AdvancedEntity[]; relationships: AdvancedRelationship[] }[]
        ): Promise<void> {
                const filtered = payloads.filter(payload => payload.entities.length || payload.relationships.length);
                if (!filtered.length) return;
                await this.batchUpsert(filtered, async payloadBatch => {
                        await this.runWrite('batchUpsertAdvancedEntities', async tx => {
                                for (const payload of payloadBatch) {
                                        await this.mergeDocumentShell(tx, payload.notePath);
                                        if (payload.entities.length) {
                                                await this.mergeAdvancedEntities(tx, payload.notePath, payload.entities);
                                        }
                                        if (payload.relationships.length) {
                                                await this.mergeAdvancedRelationships(tx, payload.relationships);
                                        }
                                }
                        });
                });
        }

        private async runWrite<T>(context: string, handler: (tx: ManagedTransaction) => Promise<T>): Promise<T> {
                const session = this.getSession();
                try {
                        return await session.executeWrite(handler);
                } catch (error) {
                        console.error(`[Neo4jService] ${context} failed`, error);
                        throw new Error(`${context} failed: ${(error as Error).message}`);
                } finally {
                        await session.close();
                }
        }

        private async mergeDocumentShell(tx: ManagedTransaction, notePath: string): Promise<void> {
                await tx.run(
                        `MERGE (doc:Document {project_name: $projectName, path: $path})
SET doc.updated_at = datetime()`,
                        { projectName: this.projectName, path: notePath }
                );
        }

        private async mergeAdvancedEntities(tx: ManagedTransaction, notePath: string, entities: AdvancedEntity[]): Promise<void> {
                for (const entityBatch of this.chunkItems(entities)) {
                        if (!entityBatch.length) continue;
                        await tx.run(
                                `UNWIND $entities AS entity
MERGE (e:Entity {project_name: $projectName, name: entity.name})
SET e.type = entity.type,
    e.description = entity.description,
    e.updated_at = datetime()
WITH e
MATCH (doc:Document {project_name: $projectName, path: $path})
MERGE (doc)-[r:MENTIONS]->(e)
SET r.last_seen = datetime()`,
                                { projectName: this.projectName, path: notePath, entities: entityBatch }
                        );
                }
        }

        private async mergeAdvancedRelationships(tx: ManagedTransaction, relationships: AdvancedRelationship[]): Promise<void> {
                for (const relationshipBatch of this.chunkItems(relationships)) {
                        if (!relationshipBatch.length) continue;
                        await tx.run(
                                `UNWIND $relationships AS rel
MATCH (src:Entity {project_name: $projectName, name: rel.src})
MATCH (tgt:Entity {project_name: $projectName, name: rel.tgt})
MERGE (src)-[r:RELATES_TO {project_name: $projectName, description: rel.description}]->(tgt)
SET r.keywords = rel.keywords,
    r.weight = rel.weight,
    r.updated_at = datetime()`,
                                { projectName: this.projectName, relationships: relationshipBatch }
                        );
                }
        }

        private chunkItems<T>(items: T[], chunkSize: number = this.effectiveBatchSize): T[][] {
                if (!Array.isArray(items) || items.length === 0) {
                        return [];
                }
                const normalizedSize = Math.max(1, chunkSize);
                const chunks: T[][] = [];
                for (let i = 0; i < items.length; i += normalizedSize) {
                        chunks.push(items.slice(i, i + normalizedSize));
                }
                return chunks;
        }

        private async batchUpsert<T>(
                items: T[],
                handler: (batch: T[]) => Promise<void>,
                batchSize: number = this.effectiveBatchSize
        ): Promise<void> {
                if (!Array.isArray(items) || items.length === 0) {
                        return;
                }
                const normalizedSize = Math.max(1, Math.min(batchSize, this.effectiveBatchSize));
                for (let i = 0; i < items.length; i += normalizedSize) {
                        const batch = items.slice(i, i + normalizedSize);
                        if (!batch.length) continue;
                        await handler(batch);
                }
        }
}
