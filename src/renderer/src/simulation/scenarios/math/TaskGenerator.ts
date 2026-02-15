import { MathTask } from './MathTypes';
import { PRNG } from '../../../common/prng';
import { RunContext } from '../../RunContext';

export class MathTaskGenerator {
    private prng: PRNG;
    private runContext?: RunContext;

    constructor(seedOrContext: number | RunContext) {
        if (typeof seedOrContext === 'number') {
            this.prng = new PRNG(seedOrContext);
        } else {
            this.runContext = seedOrContext;
            this.prng = seedOrContext.getPrng();
        }
    }

    /**
     * Generate a math task based on difficulty.
     * Auto-curriculum progression:
     * - 0.0 - 0.5: Linear equations (ax + b = c)
     * - 0.5 - 1.0: Quadratic equations (ax^2 + bx + c = 0)
     */
    public generate(difficulty: number): MathTask {
        // Determine task type based on difficulty threshold
        if (difficulty > 0.5) {
            return this.generateQuadratic(difficulty);
        }
        return this.generateLinear(difficulty);
    }

    /**
     * Generate linear equation: ax + b = c
     */
    private generateLinear(difficulty: number): MathTask {
        // Scale coefficients: 1-20 at low difficulty, up to 1-100 at high
        const maxVal = Math.floor(10 + (difficulty * 90));

        const a = this.prng.nextInt(1, Math.max(2, maxVal)); // a cannot be 0
        const x = this.prng.nextInt(-maxVal, maxVal); // The answer
        const b = this.prng.nextInt(-maxVal, maxVal);
        const c = (a * x) + b;

        return {
            id: this.runContext ? this.runContext.nextId('task') : `task-${this.prng.nextInt(0, 1000)}`,
            difficulty: difficulty,
            type: 'algebra_linear',
            statement: `${a}x + (${b}) = ${c}`,
            coefficients: [a, b, c],
            targetValue: x
        };
    }

    /**
     * Generate quadratic equation: ax^2 + bx + c = 0
     * Uses integer roots for solvability: (x - r1)(x - r2) = 0
     */
    private generateQuadratic(difficulty: number): MathTask {
        // Scale based on difficulty (0.5-1.0 maps to easier-harder quadratics)
        const scaledDiff = (difficulty - 0.5) * 2; // 0-1 range
        const maxRoot = Math.floor(5 + scaledDiff * 15); // roots from -20 to 20

        // Generate integer roots for guaranteed solvability
        const r1 = this.prng.nextInt(-maxRoot, maxRoot);
        const r2 = this.prng.nextInt(-maxRoot, maxRoot);

        // Expand (x - r1)(x - r2) = x^2 - (r1+r2)x + r1*r2
        const a = 1; // Keep leading coefficient 1 for simplicity
        const b = -(r1 + r2);
        const c = r1 * r2;

        // Statement: x^2 + bx + c = 0 (or x^2 - bx + c depending on sign)
        const bSign = b >= 0 ? '+' : '-';
        const cSign = c >= 0 ? '+' : '-';
        const statement = `x^2 ${bSign} ${Math.abs(b)}x ${cSign} ${Math.abs(c)} = 0`;

        return {
            id: this.runContext ? this.runContext.nextId('task') : `task-${this.prng.nextInt(0, 1000)}`,
            difficulty: difficulty,
            type: 'algebra_quadratic',
            statement: statement,
            coefficients: [a, b, c, r1, r2], // Store both coefficients and roots
            targetValue: r1 // Primary root (either root is valid)
        };
    }

    /**
     * Validate an answer for a task.
     */
    public validate(task: MathTask, answer: number): boolean {
        if (!task.coefficients) return false;

        if (task.type === 'algebra_linear') {
            if (task.coefficients.length < 3) return false;
            const [a, b, c] = task.coefficients;
            // Check: a*answer + b = c
            return Math.abs((a * answer + b) - c) < 0.0001;
        }

        if (task.type === 'algebra_quadratic') {
            if (task.coefficients.length < 5) return false;
            const [a, b, c, r1, r2] = task.coefficients;
            // Either root is a valid answer
            return Math.abs(answer - r1) < 0.0001 || Math.abs(answer - r2) < 0.0001;
        }

        return false;
    }
}

