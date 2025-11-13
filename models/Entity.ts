export interface Entity {
        name: string;
        type: string;
        description: string;
}

export interface CustomEntityRule {
        pattern: string;
        type: string;
        flags?: string;
}

export interface AdvancedEntityExtractionParams {
        text: string;
        entityTypes?: string[];
        customRules?: CustomEntityRule[];
        maxGleaning?: number;
}
