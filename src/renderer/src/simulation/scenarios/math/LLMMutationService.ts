/**
 * LLMMutationService - LLM-based Mutation Operators for Neuro-Symbolic Evolution
 * 
 * Uses Language Models to perform intelligent mutation of mathematical expressions.
 * Falls back to standard AST mutation when the API is unavailable.
 */

import { MathExpression, MathOperator } from './MathTypes';
import { ASTMutator } from './ASTGenome';
import { PRNG } from '../../../common/prng';

/**
 * Configuration for the LLM mutation service
 */
export interface LLMMutationConfig {
    apiKey: string;
    apiUrl: string;
    model: string;
    timeout: number;
    enabled: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_LLM_CONFIG: LLMMutationConfig = {
    apiKey: '',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-5-mini-2025-08-07',
    timeout: 5000,
    enabled: true
};

/**
 * Types of LLM-based mutations
 */
export type LLMMutationType =
    | 'generalize'     // Make the expression more general
    | 'simplify'       // Simplify the expression
    | 'extend'         // Add complexity to explore new territory
    | 'analogize';     // Create an analogous expression

/**
 * LLM Mutation Service
 * Provides intelligent mutation of mathematical expressions using LLMs
 */
export class LLMMutationService {
    private config: LLMMutationConfig;
    private fallbackMutator: ASTMutator | null = null;
    private lastError: string | null = null;
    private consecutiveFailures: number = 0;
    private readonly MAX_FAILURES = 3;

    constructor(config: Partial<LLMMutationConfig> = {}) {
        this.config = { ...DEFAULT_LLM_CONFIG, ...config };
    }

    /**
     * Check if the service is available
     */
    isAvailable(): boolean {
        return this.config.enabled &&
            this.config.apiKey.length > 0 &&
            this.consecutiveFailures < this.MAX_FAILURES;
    }

    /**
     * Get the last error message
     */
    getLastError(): string | null {
        return this.lastError;
    }

    /**
     * Reset failure counter (call after successful operations)
     */
    resetFailures(): void {
        this.consecutiveFailures = 0;
        this.lastError = null;
    }

    /**
     * Convert expression to string for LLM prompt
     */
    private exprToString(expr: MathExpression): string {
        if (expr.type === 'ATOM') {
            return expr.value?.toString() || '?';
        }
        const opMap: Record<string, string> = {
            ADD: '+', SUB: '-', MUL: '*', DIV: '/',
            POW: '^', MOD: '%', EQ: '='
        };
        const left = expr.left ? this.exprToString(expr.left) : '?';
        const right = expr.right ? this.exprToString(expr.right) : '?';
        return `(${left} ${opMap[expr.op || ''] || '?'} ${right})`;
    }

    /**
     * Parse LLM response back to expression
     * This is a simplified parser - in production, use a proper parser
     */
    private parseExpression(text: string): MathExpression | null {
        try {
            // Clean up the response
            const cleaned = text.trim().replace(/\s+/g, ' ');

            // Simple recursive descent parser for basic expressions
            return this.parseExprRecursive(cleaned, 0).expr;
        } catch (e) {
            this.lastError = `Parse error: ${e}`;
            return null;
        }
    }

    private parseExprRecursive(text: string, pos: number): { expr: MathExpression; pos: number } {
        // Skip whitespace
        while (pos < text.length && text[pos] === ' ') pos++;

        // Check for parentheses
        if (text[pos] === '(') {
            pos++; // Skip '('
            const leftResult = this.parseExprRecursive(text, pos);
            pos = leftResult.pos;

            // Skip whitespace
            while (pos < text.length && text[pos] === ' ') pos++;

            // Get operator
            const opChar = text[pos];
            const opMap: Record<string, MathOperator> = {
                '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV',
                '^': 'POW', '%': 'MOD', '=': 'EQ'
            };
            const op = opMap[opChar];
            if (!op) throw new Error(`Unknown operator: ${opChar}`);
            pos++;

            // Skip whitespace
            while (pos < text.length && text[pos] === ' ') pos++;

            const rightResult = this.parseExprRecursive(text, pos);
            pos = rightResult.pos;

            // Skip whitespace and closing paren
            while (pos < text.length && text[pos] === ' ') pos++;
            if (text[pos] === ')') pos++;

            return {
                expr: {
                    type: 'OP',
                    op,
                    left: leftResult.expr,
                    right: rightResult.expr
                },
                pos
            };
        }

        // Check for variable or number
        let value = '';
        while (pos < text.length && /[a-z0-9]/.test(text[pos])) {
            value += text[pos];
            pos++;
        }

        if (value) {
            const numValue = parseFloat(value);
            return {
                expr: {
                    type: 'ATOM',
                    value: isNaN(numValue) ? value : numValue
                },
                pos
            };
        }

        throw new Error(`Unexpected character at position ${pos}: ${text[pos]}`);
    }

    /**
     * Create a prompt for the LLM based on mutation type
     */
    private createPrompt(expr: MathExpression, mutationType: LLMMutationType): string {
        const exprStr = this.exprToString(expr);

        const prompts: Record<LLMMutationType, string> = {
            generalize: `Given the mathematical expression: ${exprStr}
Make it more general by introducing additional variables or parameters.
Respond with ONLY the new expression in the same format (parenthesized, operators: + - * / ^).
Example input: (x + 2)
Example output: (x + y)`,

            simplify: `Given the mathematical expression: ${exprStr}
Simplify it if possible, or identify a simpler equivalent form.
Respond with ONLY the simplified expression in the same format (parenthesized, operators: + - * / ^).
Example input: ((x + 0) * 1)
Example output: x`,

            extend: `Given the mathematical expression: ${exprStr}
Extend it by adding an interesting mathematical operation that might reveal new patterns.
Respond with ONLY the new expression in the same format (parenthesized, operators: + - * / ^).
Example input: (x + y)
Example output: ((x + y) * (x - y))`,

            analogize: `Given the mathematical expression: ${exprStr}
Create an analogous expression by substituting operations or variables with related ones.
Respond with ONLY the new expression in the same format (parenthesized, operators: + - * / ^).
Example input: (x + y)
Example output: (x * y)`
        };

        return prompts[mutationType];
    }

    /**
     * Call the LLM API
     */
    private async callLLM(prompt: string): Promise<string | null> {
        if (!this.isAvailable()) {
            return null;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

            const response = await fetch(this.config.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a mathematical expression transformer. Respond with ONLY the transformed expression, no explanations.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 100,
                    temperature: 0.7
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                this.consecutiveFailures++;
                this.lastError = `API error: ${response.status} ${response.statusText}`;
                return null;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (content) {
                this.resetFailures();
                return content.trim();
            }

            this.consecutiveFailures++;
            this.lastError = 'Empty response from API';
            return null;

        } catch (error: any) {
            this.consecutiveFailures++;
            this.lastError = `Request failed: ${error.message}`;
            return null;
        }
    }

    /**
     * Mutate an expression using the LLM
     * Falls back to standard AST mutation on failure
     */
    async mutate(
        expr: MathExpression,
        mutationType: LLMMutationType,
        prng: PRNG
    ): Promise<{ expr: MathExpression; usedLLM: boolean }> {
        // Try LLM mutation
        if (this.isAvailable()) {
            const prompt = this.createPrompt(expr, mutationType);
            const response = await this.callLLM(prompt);

            if (response) {
                const parsed = this.parseExpression(response);
                if (parsed) {
                    return { expr: parsed, usedLLM: true };
                }
            }
        }

        // Fallback to standard AST mutation
        if (!this.fallbackMutator) {
            this.fallbackMutator = new ASTMutator(prng);
        }

        // Map mutation types to fallback behavior
        let mutatedExpr: MathExpression;
        switch (mutationType) {
            case 'generalize':
            case 'extend':
                mutatedExpr = this.fallbackMutator.mutateGrow(expr);
                break;
            case 'simplify':
                mutatedExpr = this.fallbackMutator.mutateShrink(expr);
                break;
            case 'analogize':
            default:
                mutatedExpr = this.fallbackMutator.mutatePoint(expr);
                break;
        }

        return { expr: mutatedExpr, usedLLM: false };
    }

    /**
     * Batch mutate multiple expressions
     */
    async mutateBatch(
        expressions: MathExpression[],
        prng: PRNG
    ): Promise<{ expressions: MathExpression[]; llmCount: number }> {
        const mutationTypes: LLMMutationType[] = ['generalize', 'simplify', 'extend', 'analogize'];
        let llmCount = 0;

        const results = await Promise.all(
            expressions.map(async (expr) => {
                const mutationType = mutationTypes[prng.nextInt(0, mutationTypes.length)];
                const result = await this.mutate(expr, mutationType, prng);
                if (result.usedLLM) llmCount++;
                return result.expr;
            })
        );

        return { expressions: results, llmCount };
    }
}

/**
 * Singleton instance with environment configuration
 */
let _instance: LLMMutationService | null = null;

export function getLLMMutationService(): LLMMutationService {
    if (!_instance) {
        // In browser/renderer context, use VITE env vars
        const apiKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_AI_API_KEY) || '';
        const apiUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_AI_API_URL) || DEFAULT_LLM_CONFIG.apiUrl;

        _instance = new LLMMutationService({
            apiKey,
            apiUrl,
            enabled: apiKey.length > 0
        });
    }
    return _instance;
}
