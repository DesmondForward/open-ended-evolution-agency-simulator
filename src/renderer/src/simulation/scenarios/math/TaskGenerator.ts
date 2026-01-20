import { MathTask } from './MathTypes';
import { PRNG } from '../../../common/prng';

export class MathTaskGenerator {
    private prng: PRNG;

    constructor(seed: number) {
        this.prng = new PRNG(seed);
    }

    public generate(difficulty: number): MathTask {
        // Map 0-1 difficulty to task types
        // 0.0 - 0.3: Linear equations (ax + b = c)
        // 0.3 - 0.7: Introduction of large numbers
        // 0.7 - 1.0: Quadratic equations (x^2 + bx + c = 0)

        const typeRoll = this.prng.next();

        // MVP: Just Linear for now, but scale coefficients with difficulty

        // Coefficient scale: 1 to 100 based on difficulty
        const maxVal = Math.floor(10 + (difficulty * 90));

        const a = this.prng.nextInt(1, maxVal); // a cannot be 0
        const x = this.prng.nextInt(-maxVal, maxVal); // The answer
        const b = this.prng.nextInt(-maxVal, maxVal);
        const c = (a * x) + b; // value

        return {
            id: `task-${Date.now()}-${this.prng.nextInt(0, 1000)}`,
            difficulty: difficulty,
            type: 'algebra_linear',
            statement: `${a}x + (${b}) = ${c}`,
            coefficients: [a, b, c], // store for validation logic if needed
            targetValue: x // The answer we expect
        };
    }

    public validate(task: MathTask, answer: number): boolean {
        if (!task.coefficients || task.coefficients.length !== 3) return false;
        const [a, b, c] = task.coefficients;
        // Check: a*ANSWER + b = c
        // Allow small float tolerance if we move to floats later, but integers for now.
        return Math.abs((a * answer + b) - c) < 0.0001;
    }
}
