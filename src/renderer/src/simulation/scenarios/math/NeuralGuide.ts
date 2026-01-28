/**
 * NeuralGuide - Lightweight Neural Network for Neuro-Symbolic Guidance
 * 
 * A simple Multi-Layer Perceptron (MLP) implemented in pure TypeScript.
 * Used to predict the "interestingness" of mathematical conjectures or
 * to select the best mutation strategy based on the current expression state.
 */

import { PRNG } from '../../../common/prng';
import { MathExpression } from './MathTypes';

/**
 * Neural Network Layer
 */
interface Layer {
    weights: number[][]; // weights[input][output]
    biases: number[];    // biases[output]
    activation: 'relu' | 'sigmoid' | 'tanh' | 'linear';
}

/**
 * Neural Guide Configuration
 */
export interface NeuralGuideConfig {
    inputSize: number;
    hiddenSizes: number[];
    outputSize: number;
    learningRate: number;
}

export class NeuralGuide {
    private layers: Layer[] = [];
    private config: NeuralGuideConfig;
    private prng: PRNG;

    constructor(config: NeuralGuideConfig, seed: number) {
        this.config = config;
        this.prng = new PRNG(seed);
        this.initializeLayers();
    }

    /**
     * Initialize weights and biases randomly
     */
    private initializeLayers(): void {
        const sizes = [this.config.inputSize, ...this.config.hiddenSizes, this.config.outputSize];

        for (let i = 0; i < sizes.length - 1; i++) {
            const inputSize = sizes[i];
            const outputSize = sizes[i + 1];

            // Xavier/Glorot initialization
            const limit = Math.sqrt(6 / (inputSize + outputSize));

            const weights: number[][] = [];
            for (let j = 0; j < inputSize; j++) {
                const row: number[] = [];
                for (let k = 0; k < outputSize; k++) {
                    row.push(this.prng.next() * 2 * limit - limit);
                }
                weights.push(row);
            }

            const biases: number[] = new Array(outputSize).fill(0);

            this.layers.push({
                weights,
                biases,
                activation: i === sizes.length - 2 ? 'sigmoid' : 'relu' // Sigmoid for output (0-1), ReLU for hidden
            });
        }
    }

    /**
     * Forward pass
     */
    public predict(inputs: number[]): number[] {
        if (inputs.length !== this.config.inputSize) {
            throw new Error(`Input size mismatch: expected ${this.config.inputSize}, got ${inputs.length}`);
        }

        let current = [...inputs];

        for (const layer of this.layers) {
            const next: number[] = [];
            for (let j = 0; j < layer.biases.length; j++) {
                let sum = layer.biases[j];
                for (let i = 0; i < current.length; i++) {
                    sum += current[i] * layer.weights[i][j];
                }
                next.push(this.activate(sum, layer.activation));
            }
            current = next;
        }

        return current;
    }

    /**
     * Activation functions
     */
    private activate(x: number, type: string): number {
        switch (type) {
            case 'relu': return Math.max(0, x);
            case 'sigmoid': return 1 / (1 + Math.exp(-x));
            case 'tanh': return Math.tanh(x);
            case 'linear': return x;
            default: return x;
        }
    }

    /**
     * Extract features from a math expression to feed into the network
     * Simplified feature extraction:
     * 1. Depth
     * 2. Node count
     * 3. Variable count
     * 4. Operator counts (ADD, SUB, MUL, DIV)
     */
    public featurize(expr: MathExpression): number[] {
        const stats = {
            depth: 0,
            nodes: 0,
            vars: 0,
            ops: { ADD: 0, SUB: 0, MUL: 0, DIV: 0, POW: 0, MOD: 0, EQ: 0 }
        };

        this.traverse(expr, 1, stats);

        // Normalize features (rough approximations)
        return [
            Math.min(1, stats.depth / 10),
            Math.min(1, stats.nodes / 50),
            Math.min(1, stats.vars / 5),
            Math.min(1, stats.ops.ADD / 10),
            Math.min(1, stats.ops.SUB / 10),
            Math.min(1, stats.ops.MUL / 10),
            Math.min(1, stats.ops.DIV / 10)
        ];
    }

    private traverse(expr: MathExpression, depth: number, stats: any) {
        stats.depth = Math.max(stats.depth, depth);
        stats.nodes++;

        if (expr.type === 'ATOM') {
            if (typeof expr.value === 'string') {
                stats.vars++;
            }
        } else if (expr.type === 'OP' && expr.op) {
            if (stats.ops[expr.op] !== undefined) {
                stats.ops[expr.op]++;
            }
            if (expr.left) this.traverse(expr.left, depth + 1, stats);
            if (expr.right) this.traverse(expr.right, depth + 1, stats);
        }
    }

    /**
     * Train the network (Simple Gradient Descent placeholder)
     * In a real system, this would implement backpropagation.
     * Here we just mutate weights slightly towards a target (Evolutionary Strategy)
     * because implementing full backprop in a single file is overkill for this mock.
     */
    public train(inputs: number[], target: number[]): void {
        // Evolutionary Strategy / Perturbation learning
        // If the prediction was far off, perturb weights
        const prediction = this.predict(inputs);
        const error = target.reduce((sum, t, i) => sum + Math.abs(t - prediction[i]), 0);

        if (error > 0.1) {
            this.mutate(this.config.learningRate * error);
        }
    }

    /**
     * Mutate weights (Neuro-evolution)
     */
    public mutate(rate: number): void {
        for (const layer of this.layers) {
            for (let i = 0; i < layer.weights.length; i++) {
                for (let j = 0; j < layer.weights[i].length; j++) {
                    if (this.prng.next() < 0.1) {
                        layer.weights[i][j] += (this.prng.next() - 0.5) * rate;
                    }
                }
            }
            for (let j = 0; j < layer.biases.length; j++) {
                if (this.prng.next() < 0.1) {
                    layer.biases[j] += (this.prng.next() - 0.5) * rate;
                }
            }
        }
    }

    /**
     * Serialize network state
     */
    public serialize(): any {
        return {
            config: this.config,
            layers: this.layers
        };
    }

    /**
     * Deserialize network state
     */
    public static deserialize(data: any): NeuralGuide {
        const guide = new NeuralGuide(data.config, 0); // Seed doesn't matter when loading weights
        guide.layers = data.layers;
        return guide;
    }
}
