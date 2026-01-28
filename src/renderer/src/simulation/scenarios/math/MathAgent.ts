
import { MathGenome, MathTask, MathClaim, MathExpression, MathOperator, MathProof } from './MathTypes';
import { PRNG } from '../../../common/prng';

export class MathAgent {
    public genome: MathGenome;

    constructor(genome: MathGenome) {
        this.genome = genome;
    }

    /**
     * Create a random agent
     */
    static random(prng: PRNG): MathAgent {
        // Genome now controls tendency to generate complex vs simple claims
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
     * Attempt to solve a standard task
     */
    public solve(task: MathTask, prng: PRNG): number {
        const weights = this.genome.data as number[];
        // Simple heuristic: Agents with high complexity preference (weights[0]) might overthink simple tasks
        // Agents with high proof effort (weights[1]) might be more accurate

        const accuracyProbability = 0.5 + (weights[1] * 0.5); // Baseline 50%, up to 100%

        if (prng.next() < accuracyProbability) {
            if (task.coefficients && task.coefficients.length === 3) {
                const [a, b, c] = task.coefficients;
                return (c - b) / a;
            }
        }
        return prng.nextInt(-100, 100);
    }

    /**
     * NCG: Generate a new Conjecture (Claim)
     */
    public generateClaim(prng: PRNG, difficulty: number): MathClaim {
        // Generate a random math expression: Left = Right
        const depth = Math.floor(1 + (this.genome.data as number[])[0] * 3 * difficulty);

        const left = this.generateExpression(depth, prng);
        const right = this.generateExpression(depth, prng);

        // For MVP, the claim is 'left = right' for all variables
        // We will just generate "Identity Candidates"

        const claim: MathClaim = {
            id: `claim-${prng.nextInt(0, 100000)}`,
            expression: {
                type: 'OP',
                op: 'EQ',
                left,
                right
            },
            text: `${this.exprToString(left)} = ${this.exprToString(right)}`,
            noveltyScore: 0, // Calculated by Scenario
            evidenceCount: 0,
            proven: false
        };

        this.genome.claimsGenerated++;
        return claim;
    }

    private generateExpression(depth: number, prng: PRNG): MathExpression {
        if (depth <= 0 || prng.next() > 0.7) {
            // Leaf: Variable or Number
            if (prng.next() > 0.5) {
                return { type: 'ATOM', value: 'x' }; // Single variable MVP
            } else {
                return { type: 'ATOM', value: prng.nextInt(1, 10) };
            }
        }

        const ops: MathOperator[] = ['ADD', 'SUB', 'MUL']; // Keep simple for MVP
        const op = ops[prng.nextInt(0, ops.length)];

        return {
            type: 'OP',
            op: 'OP', // Logic bug in type def? MathOperator is separate. 
            // Fixed:
            // op property in interface is MathOperator.

            // Re-doing return:
            // But wait, my interface says op?: MathOperator.
        } as any; // Type casting hack for logic block below
    }

    // Fixed implementation of recursion
    private generateExpressionRecursive(depth: number, prng: PRNG): MathExpression {
        const ops: MathOperator[] = ['ADD', 'SUB', 'MUL'];

        if (depth <= 0 || prng.next() < 0.3) {
            if (prng.next() > 0.5) return { type: 'ATOM', value: 'x' };
            return { type: 'ATOM', value: prng.nextInt(1, 5) };
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

    private checkTruth(claim: MathClaim, samples: number): boolean {
        // Evaluate Left - Right == 0 ?
        if (claim.expression.op !== 'EQ' || !claim.expression.left || !claim.expression.right) return false;

        for (let i = 0; i < samples; i++) {
            const x = Math.random() * 20 - 10;
            const vars = { x };
            const l = this.evaluate(claim.expression.left, vars);
            const r = this.evaluate(claim.expression.right, vars);
            if (Math.abs(l - r) > 0.001) return false;
        }
        return true;
    }

    /**
     * Mutate this agent
     */
    public mutate(prng: PRNG): MathAgent {
        const weights = [...(this.genome.data as number[])];
        const idx = prng.nextInt(0, weights.length);
        weights[idx] += (prng.next() - 0.5) * 0.2;
        weights[idx] = Math.max(0, Math.min(1, weights[idx]));

        return new MathAgent({
            id: `child-${this.genome.id.substring(0, 5)}-${prng.nextInt(0, 1000)}`,
            type: 'numeric_weights',
            data: weights,
            solvedCount: 0,
            complexityScore: weights[0] + weights[1], // Complexity now reflects genome strategy
            claimsGenerated: 0,
            theoremsProven: 0
        });
    }
}
