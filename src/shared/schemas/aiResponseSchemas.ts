export type JsonSchema = {
    type: 'object';
    additionalProperties?: boolean;
    required?: string[];
    properties: Record<string, unknown>;
};

export const aiControlResponseSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['u', 'reasoning'],
    properties: {
        u: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string', minLength: 1 },
        params: { type: 'object' }
    }
};

export const aiDescriptionResponseSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'description', 'tags', 'cognitiveHorizon', 'competency'],
    properties: {
        name: { type: 'string', minLength: 1 },
        description: { type: 'string', minLength: 1 },
        tags: {
            type: 'array',
            minItems: 1,
            maxItems: 8,
            items: { type: 'string', minLength: 1 }
        },
        cognitiveHorizon: { type: 'number', minimum: 0, maximum: 1 },
        competency: { type: 'number', minimum: 0, maximum: 1 }
    }
};
