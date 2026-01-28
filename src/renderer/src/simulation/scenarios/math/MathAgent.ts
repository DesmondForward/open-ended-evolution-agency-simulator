import { MathGenome, MathTask, MathClaim, MathExpression, MathOperator, MathProof, ASTGenomeData } from './MathTypes';
import { PRNG } from '../../../common/prng';
import { ASTGenomeFactory, ASTMutator } from './ASTGenome';
import { NeuralGuide } from './NeuralGuide';

export class MathAgent {
    public genome: MathGenome;

    constructor(genome: MathGenome) {
        this.genome = genome;
    }

    /**
     * Create a random agent
     * @param useAST - If true, creates an AST-based genome for neuro-symbolic evolution
     */
    static random(prng: PRNG, useAST: boolean = false): MathAgent {
        if (useAST) {
            return new MathAgent(ASTGenomeFactory.createRandom(prng));
        }

        // Standard numeric weights genome
        // [p_complexity, p_proof_effort, p_verification]
        const weights = [prng.next(), prng.next(), prng.next()];
        const sum = weights.reduce((a, b) => a + b, 0);
        const normalized = weights.map(w => w / sum);

        return new MathAgent({
            id: `agent-${Date.now()}-${prng.nextInt(0, 10000)}`,
            type: 'numeric_weights',
            data: normalized,
            solvedCount: 0,
            complexityScore: 0.1,
            claimsGenerated: 0,
            theoremsProven: 0
        });
    }

    /**
     * Attempt to solve a standard task (linear or quadratic)
     */
    public solve(task: MathTask, prng: PRNG): number {
        // Get accuracy probability based on genome type
        let accuracyProbability: number;
        let complexityWeight: number;

        if (this.genome.type === 'ast') {
            const astData = this.genome.data as ASTGenomeData;
            // AST genomes use their mutation bias for accuracy
            accuracyProbability = 0.6 + (astData.mutationBias.preferComplex * 0.3);
            complexityWeight = astData.mutationBias.preferComplex;
        } else {
            const weights = this.genome.data as number[];
            accuracyProbability = 0.5 + (weights[1] * 0.5);
            complexityWeight = weights[0];
        }

        // SOTA Recommendation: Connect Difficulty to Performance
        const effectiveAccuracy = accuracyProbability * Math.max(0.1, (1 - task.difficulty));

        if (prng.next() < effectiveAccuracy && task.coefficients) {
            // Linear equation: ax + b = c → x = (c - b) / a
            if (task.type === 'algebra_linear' && task.coefficients.length >= 3) {
                const [a, b, c] = task.coefficients;
                if (a !== 0) return (c - b) / a;
            }

            // Quadratic equation: ax² + bx + c = 0 (roots stored in coefficients)
            if (task.type === 'algebra_quadratic' && task.coefficients.length >= 5) {
                const [a, b, c, r1, r2] = task.coefficients;
                return complexityWeight > 0.5 ? r1 : r2;
            }
        }
        return prng.nextInt(-100, 100);
    }

    /**
     * NCG: Generate a new Conjecture (Claim)
     */
    public generateClaim(prng: PRNG, difficulty: number): MathClaim {
        let left: MathExpression;
        let right: MathExpression;
        let estimatedInterestingness = 0;

        if (this.genome.type === 'ast') {
            // AST genomes use their conjecture template as basis
            const astData = this.genome.data as ASTGenomeData;
            const mutator = new ASTMutator(prng);

            // Use template with mutations based on difficulty
            left = mutator.mutate(astData.conjectureTemplate, difficulty * 0.5);
            right = mutator.mutate(astData.conjectureTemplate, difficulty * 0.5);

            // Neuro-Symbolic Guidance:
            // If we have a neural guide, use it to evaluate/tweak the claim
            if (astData.neuralGuide) {
                // SOTA: Properly hydrate the neural guide
                const neural = NeuralGuide.deserialize(astData.neuralGuide.weights);

                // Feature extraction


                // Feature extraction
                const features = neural.featurize({ type: 'OP', op: 'EQ', left, right });
                const prediction = neural.predict(features);
                estimatedInterestingness = prediction[0]; // Output 0 is "interestingness"
            }
        } else {
            // Standard numeric weights approach
            const depth = Math.floor(1 + (this.genome.data as number[])[0] * 3 * difficulty);
            left = this.generateExpression(depth, prng);
            right = this.generateExpression(depth, prng);
        }

        const claim: MathClaim = {
            id: `claim-${prng.nextInt(0, 100000)}`,
            expression: {
                type: 'OP',
                op: 'EQ',
                left,
                right
            },
            text: `${this.exprToString(left)} = ${this.exprToString(right)}`,
            noveltyScore: estimatedInterestingness, // Initialize with neural prediction
            evidenceCount: 0,
            proven: false
        };

        this.genome.claimsGenerated++;
        return claim;
    }

    /**
     * Generate a mathematical expression tree of given depth.
     * Properly delegates to the recursive implementation.
     */
    private generateExpression(depth: number, prng: PRNG): MathExpression {
        return this.generateExpressionRecursive(depth, prng);
    }

    /**
     * Recursive expression tree generation with multi-variable support.
     * Supports variables: x, y for richer mathematical expressions.
     */
    private generateExpressionRecursive(depth: number, prng: PRNG): MathExpression {
        const ops: MathOperator[] = ['ADD', 'SUB', 'MUL', 'DIV'];
        const variables = ['x', 'y'];

        if (depth <= 0 || prng.next() < 0.3) {
            // Leaf node: variable or constant
            const leafType = prng.next();
            if (leafType > 0.6) {
                // Variable (x or y)
                return { type: 'ATOM', value: variables[prng.nextInt(0, variables.length)] };
            } else {
                // Constant (1-5)
                return { type: 'ATOM', value: prng.nextInt(1, 5) };
            }
        }

        const op = ops[prng.nextInt(0, ops.length)];
        return {
            type: 'OP',
            op: op,
            left: this.generateExpressionRecursive(depth - 1, prng),
            right: this.generateExpressionRecursive(depth - 1, prng)
        };
    }

    // Public wrapper that calls the recursive one
    public generateExpressionLogic(depth: number, prng: PRNG): MathExpression {
        return this.generateExpressionRecursive(depth, prng);
    }

    public exprToString(calc: MathExpression): string {
        if (calc.type === 'ATOM') return calc.value?.toString() || '?';
        const left = calc.left ? this.exprToString(calc.left) : '';
        const right = calc.right ? this.exprToString(calc.right) : '';
        const opMap: Record<string, string> = { ADD: '+', SUB: '-', MUL: '*', DIV: '/', POW: '^', EQ: '=' };
        return `(${left} ${opMap[calc.op || ''] || '?'} ${right})`;
    }

    /**
     * NCG: Attempt to prove a claim
     * MVP: We simulate proof search. 
     * If the claim is actually true (we check it with random values), 
     * and the agent has high "proof effort", we grant a "proven" status.
     */
    public prove(claim: MathClaim, prng: PRNG): MathProof | undefined {
        const effort = (this.genome.data as number[])[1];

        // 1. Check truth first via sampling (Counter-example search)
        if (!this.checkTruth(claim, 10)) {
            // Found counter example, so it's disproven
            return undefined;
        }

        // 2. If true, chance to prove based on effort
        if (prng.next() < effort * 0.8) {
            this.genome.theoremsProven++;
            return {
                isValid: true,
                steps: ['Apply Axiom A', 'Simplification', 'QED'],
                axiomsUsed: ['Identity', 'Commutativity']
            };
        }

        return undefined;
    }

    // Helper: Evaluation
    private evaluate(expr: MathExpression, vars: Record<string, number>): number {
        if (expr.type === 'ATOM') {
            if (typeof expr.value === 'string') return vars[expr.value] || 0;
            return (expr.value as number);
        }

        const l = expr.left ? this.evaluate(expr.left, vars) : 0;
        const r = expr.right ? this.evaluate(expr.right, vars) : 0;

        switch (expr.op) {
            case 'ADD': return l + r;
            case 'SUB': return l - r;
            case 'MUL': return l * r;
            case 'DIV': return r !== 0 ? l / r : 0;
            case 'POW': return Math.pow(l, r);
            case 'EQ': return Math.abs(l - r) < 0.001 ? 1 : 0;
            default: return 0;
        }
    }

    /**
     * Check if a claim holds true across random samples.
     * Uses deterministic sampling based on claim ID for reproducibility.
     */
    private checkTruth(claim: MathClaim, samples: number): boolean {
        // Evaluate Left - Right == 0 ?
        if (claim.expression.op !== 'EQ' || !claim.expression.left || !claim.expression.right) return false;

        // Use deterministic seed based on claim ID for reproducibility
        const seedFromId = claim.id.split('-').reduce((acc, part) => acc + parseInt(part) || 0, 0);
        const testPrng = new PRNG(seedFromId);

        for (let i = 0; i < samples; i++) {
            const x = testPrng.next() * 20 - 10;
            const y = testPrng.next() * 20 - 10;
            const vars = { x, y };
            const l = this.evaluate(claim.expression.left, vars);
            const r = this.evaluate(claim.expression.right, vars);

            // Handle NaN/Infinity from division by zero
            if (!isFinite(l) || !isFinite(r)) continue;

            if (Math.abs(l - r) > 0.001) return false;
        }
        return true;
    }

    /**
     * Mutate this agent
     */
    public mutate(prng: PRNG): MathAgent {
        if (this.genome.type === 'ast') {
            // Use AST-specific mutation
            return new MathAgent(ASTGenomeFactory.mutate(this.genome, prng));
        }

        // Standard numeric weights mutation
        const weights = [...(this.genome.data as number[])];
        const idx = prng.nextInt(0, weights.length);
        weights[idx] += (prng.next() - 0.5) * 0.2;
        weights[idx] = Math.max(0, Math.min(1, weights[idx]));

        return new MathAgent({
            id: `child-${this.genome.id.substring(0, 5)}-${prng.nextInt(0, 1000)}`,
            type: 'numeric_weights',
            data: weights,
            solvedCount: 0,
            complexityScore: weights[0] + weights[1],
            claimsGenerated: 0,
            theoremsProven: 0
        });
    }
}
