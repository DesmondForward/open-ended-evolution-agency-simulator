/**
 * ASTGenome - Neuro-Symbolic Evolution via AST Mutation
 * 
 * This module implements Program Synthesis through direct AST evolution,
 * a SOTA approach where agents evolve program structures instead of just weights.
 */

import { MathExpression, MathOperator, ASTGenomeData, MathGenome, NeuralGenomeData } from './MathTypes';
import { PRNG } from '../../../common/prng';
import { NeuralGuide, NeuralGuideConfig } from './NeuralGuide';
import { RunContext } from '../../RunContext';

/**
 * Available operators for AST evolution
 */
const ALL_OPERATORS: MathOperator[] = ['ADD', 'SUB', 'MUL', 'DIV', 'POW', 'MOD'];
const VARIABLES = ['x', 'y', 'z'];

/**
 * AST Mutation Operators for Neuro-Symbolic Evolution
 */
export class ASTMutator {
    private prng: PRNG;

    constructor(prng: PRNG) {
        this.prng = prng;
    }

    /**
     * Clone a MathExpression deeply (public for crossover operations)
     */
    public cloneExpr(expr: MathExpression): MathExpression {
        if (expr.type === 'ATOM') {
            return { type: 'ATOM', value: expr.value };
        }
        return {
            type: 'OP',
            op: expr.op,
            left: expr.left ? this.cloneExpr(expr.left) : undefined,
            right: expr.right ? this.cloneExpr(expr.right) : undefined
        };
    }

    /**
     * Count nodes in an expression tree
     */
    private countNodes(expr: MathExpression): number {
        if (expr.type === 'ATOM') return 1;
        let count = 1;
        if (expr.left) count += this.countNodes(expr.left);
        if (expr.right) count += this.countNodes(expr.right);
        return count;
    }

    /**
     * Get a random node from the expression tree
     */
    private getRandomNode(expr: MathExpression, targetIndex: number, current: { index: number }): MathExpression | null {
        if (current.index === targetIndex) {
            return expr;
        }
        current.index++;

        if (expr.type === 'OP') {
            if (expr.left) {
                const found = this.getRandomNode(expr.left, targetIndex, current);
                if (found) return found;
            }
            if (expr.right) {
                const found = this.getRandomNode(expr.right, targetIndex, current);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Replace a node at a specific index with a new expression
     */
    private replaceNode(expr: MathExpression, targetIndex: number, replacement: MathExpression, current: { index: number }): MathExpression {
        if (current.index === targetIndex) {
            current.index++;
            return this.cloneExpr(replacement);
        }
        current.index++;

        if (expr.type === 'ATOM') {
            return this.cloneExpr(expr);
        }

        return {
            type: 'OP',
            op: expr.op,
            left: expr.left ? this.replaceNode(expr.left, targetIndex, replacement, current) : undefined,
            right: expr.right ? this.replaceNode(expr.right, targetIndex, replacement, current) : undefined
        };
    }

    /**
     * Mutation 1: Point Mutation
     * Change a single node (operator or atom value)
     */
    mutatePoint(expr: MathExpression): MathExpression {
        const cloned = this.cloneExpr(expr);
        const nodeCount = this.countNodes(cloned);
        const targetIdx = this.prng.nextInt(0, nodeCount);
        const target = this.getRandomNode(cloned, targetIdx, { index: 0 });

        if (!target) return cloned;

        if (target.type === 'ATOM') {
            // Change atom: variable <-> constant, or change value
            if (this.prng.next() < 0.5) {
                // Switch to variable
                target.value = VARIABLES[this.prng.nextInt(0, VARIABLES.length)];
            } else {
                // Switch to constant
                target.value = this.prng.nextInt(1, 10);
            }
        } else if (target.type === 'OP' && target.op) {
            // Change operator
            const newOp = ALL_OPERATORS[this.prng.nextInt(0, ALL_OPERATORS.length)];
            target.op = newOp;
        }

        return cloned;
    }

    /**
     * Mutation 2: Subtree Replacement
     * Replace a random subtree with a new random subtree
     */
    mutateSubtree(expr: MathExpression, maxDepth: number = 3): MathExpression {
        const nodeCount = this.countNodes(expr);
        const targetIdx = this.prng.nextInt(0, nodeCount);
        const newSubtree = this.generateRandomExpr(maxDepth);

        return this.replaceNode(expr, targetIdx, newSubtree, { index: 0 });
    }

    /**
     * Mutation 3: Grow
     * Wrap a node in a new operator with a random sibling
     */
    mutateGrow(expr: MathExpression): MathExpression {
        const cloned = this.cloneExpr(expr);
        const nodeCount = this.countNodes(cloned);
        const targetIdx = this.prng.nextInt(0, nodeCount);
        const target = this.getRandomNode(cloned, targetIdx, { index: 0 });

        if (!target) return cloned;

        // Create a wrapper operation
        const op = ALL_OPERATORS[this.prng.nextInt(0, ALL_OPERATORS.length)];
        const sibling: MathExpression = this.prng.next() < 0.5
            ? { type: 'ATOM', value: VARIABLES[this.prng.nextInt(0, VARIABLES.length)] }
            : { type: 'ATOM', value: this.prng.nextInt(1, 10) };

        const wrapper: MathExpression = {
            type: 'OP',
            op,
            left: this.cloneExpr(target),
            right: sibling
        };

        return this.replaceNode(expr, targetIdx, wrapper, { index: 0 });
    }

    /**
     * Mutation 4: Shrink
     * Replace a subtree with one of its children (simplification)
     */
    mutateShrink(expr: MathExpression): MathExpression {
        const nodeCount = this.countNodes(expr);
        if (nodeCount < 2) return this.cloneExpr(expr);

        const targetIdx = this.prng.nextInt(1, nodeCount); // Skip root
        const target = this.getRandomNode(expr, targetIdx, { index: 0 });

        if (!target || target.type === 'ATOM') return this.cloneExpr(expr);

        // Replace with one of its children
        const replacement = this.prng.next() < 0.5 && target.left ? target.left : (target.right || target.left);
        if (!replacement) return this.cloneExpr(expr);

        return this.replaceNode(expr, targetIdx, replacement, { index: 0 });
    }

    /**
     * Crossover: Combine two expressions
     * Take a subtree from parent2 and insert it into parent1
     */
    crossover(parent1: MathExpression, parent2: MathExpression): MathExpression {
        const count1 = this.countNodes(parent1);
        const count2 = this.countNodes(parent2);

        const targetIdx1 = this.prng.nextInt(0, count1);
        const sourceIdx2 = this.prng.nextInt(0, count2);

        const subtree = this.getRandomNode(parent2, sourceIdx2, { index: 0 });
        if (!subtree) return this.cloneExpr(parent1);

        return this.replaceNode(parent1, targetIdx1, subtree, { index: 0 });
    }

    /**
     * Generate a random expression of given max depth
     */
    generateRandomExpr(maxDepth: number): MathExpression {
        if (maxDepth <= 0 || this.prng.next() < 0.3) {
            // Leaf node
            if (this.prng.next() < 0.6) {
                return { type: 'ATOM', value: VARIABLES[this.prng.nextInt(0, VARIABLES.length)] };
            }
            return { type: 'ATOM', value: this.prng.nextInt(1, 10) };
        }

        const op = ALL_OPERATORS[this.prng.nextInt(0, ALL_OPERATORS.length)];
        return {
            type: 'OP',
            op,
            left: this.generateRandomExpr(maxDepth - 1),
            right: this.generateRandomExpr(maxDepth - 1)
        };
    }

    /**
     * Apply a random mutation to an expression
     */
    mutate(expr: MathExpression, mutationRate: number = 0.2): MathExpression {
        if (this.prng.next() > mutationRate) {
            return this.cloneExpr(expr);
        }

        const mutationType = this.prng.next();
        if (mutationType < 0.3) {
            return this.mutatePoint(expr);
        } else if (mutationType < 0.5) {
            return this.mutateSubtree(expr, 2);
        } else if (mutationType < 0.7) {
            return this.mutateGrow(expr);
        } else {
            return this.mutateShrink(expr);
        }
    }
}

/**
 * Factory for creating AST-based genomes
 */
export class ASTGenomeFactory {
    /**
     * Create a random AST genome
     */
    static createRandom(prng: PRNG, runContext?: RunContext): MathGenome {
        const mutator = new ASTMutator(prng);

        const astData: ASTGenomeData = {
            solverStrategy: mutator.generateRandomExpr(3),
            conjectureTemplate: mutator.generateRandomExpr(2),
            mutationBias: {
                preferVariables: prng.next(),
                preferComplex: prng.next(),
                operatorWeights: {
                    'ADD': prng.next(),
                    'SUB': prng.next(),
                    'MUL': prng.next(),
                    'DIV': prng.next() * 0.5, // Reduce division preference
                    'POW': prng.next() * 0.3, // Reduce power preference
                    'MOD': prng.next() * 0.3,
                    'EQ': 0 // Not used in sub-expressions
                }
            },
            neuralGuide: ASTGenomeFactory.createRandomNeuralGuide(prng)
        };

        return {
            id: runContext ? runContext.nextId('ast') : `ast-${prng.nextInt(0, 10000)}`,
            type: 'ast',
            data: astData,
            solvedCount: 0,
            complexityScore: 0.5,
            claimsGenerated: 0,
            theoremsProven: 0
        };
    }

    /**
     * Mutate an AST genome
     */
    static mutate(genome: MathGenome, prng: PRNG): MathGenome {
        if (genome.type !== 'ast') {
            throw new Error('Cannot AST-mutate non-AST genome');
        }

        const astData = genome.data as ASTGenomeData;
        const mutator = new ASTMutator(prng);

        const newAstData: ASTGenomeData = {
            solverStrategy: mutator.mutate(astData.solverStrategy, 0.3),
            conjectureTemplate: mutator.mutate(astData.conjectureTemplate, 0.2),
            mutationBias: {
                preferVariables: Math.max(0, Math.min(1, astData.mutationBias.preferVariables + (prng.next() - 0.5) * 0.1)),
                preferComplex: Math.max(0, Math.min(1, astData.mutationBias.preferComplex + (prng.next() - 0.5) * 0.1)),
                operatorWeights: { ...astData.mutationBias.operatorWeights }
            },
            neuralGuide: astData.neuralGuide
        };

        // Mutate Neural Guide if it exists
        if (astData.neuralGuide) {
            const guide = NeuralGuide.deserialize(astData.neuralGuide.weights);
            guide.mutate(0.1);
            newAstData.neuralGuide = {
                config: astData.neuralGuide.config,
                weights: guide.serialize()
            };
        }

        // Mutate one operator weight
        const ops = Object.keys(newAstData.mutationBias.operatorWeights) as MathOperator[];
        const opToMutate = ops[prng.nextInt(0, ops.length)];
        newAstData.mutationBias.operatorWeights[opToMutate] = Math.max(0, Math.min(1,
            newAstData.mutationBias.operatorWeights[opToMutate] + (prng.next() - 0.5) * 0.2
        ));

        const newGenome: MathGenome = {
            id: `ast-${genome.id.substring(0, 8)}-${prng.nextInt(0, 1000)}`,
            type: 'ast',
            data: newAstData,
            solvedCount: 0,
            complexityScore: 0,
            claimsGenerated: 0,
            theoremsProven: 0
        };
        newGenome.complexityScore = ASTGenomeFactory.getComplexity(newGenome);
        return newGenome;
    }

    /**
     * Crossover two AST genomes
     */
    static crossover(parent1: MathGenome, parent2: MathGenome, prng: PRNG): MathGenome {
        if (parent1.type !== 'ast' || parent2.type !== 'ast') {
            throw new Error('Cannot crossover non-AST genomes');
        }

        const data1 = parent1.data as ASTGenomeData;
        const data2 = parent2.data as ASTGenomeData;
        const mutator = new ASTMutator(prng);

        const newAstData: ASTGenomeData = {
            solverStrategy: mutator.crossover(data1.solverStrategy, data2.solverStrategy),
            conjectureTemplate: prng.next() < 0.5 ? mutator.cloneExpr(data1.conjectureTemplate) : mutator.cloneExpr(data2.conjectureTemplate),
            mutationBias: {
                preferVariables: (data1.mutationBias.preferVariables + data2.mutationBias.preferVariables) / 2,
                preferComplex: (data1.mutationBias.preferComplex + data2.mutationBias.preferComplex) / 2,
                operatorWeights: {
                    'ADD': (data1.mutationBias.operatorWeights.ADD + data2.mutationBias.operatorWeights.ADD) / 2,
                    'SUB': (data1.mutationBias.operatorWeights.SUB + data2.mutationBias.operatorWeights.SUB) / 2,
                    'MUL': (data1.mutationBias.operatorWeights.MUL + data2.mutationBias.operatorWeights.MUL) / 2,
                    'DIV': (data1.mutationBias.operatorWeights.DIV + data2.mutationBias.operatorWeights.DIV) / 2,
                    'POW': (data1.mutationBias.operatorWeights.POW + data2.mutationBias.operatorWeights.POW) / 2,
                    'MOD': (data1.mutationBias.operatorWeights.MOD + data2.mutationBias.operatorWeights.MOD) / 2,
                    'EQ': 0
                }
            },
            neuralGuide: prng.next() < 0.5 ? data1.neuralGuide : data2.neuralGuide
        };

        const newGenome: MathGenome = {
            id: `ast-child-${prng.nextInt(0, 10000)}`,
            type: 'ast',
            data: newAstData,
            solvedCount: 0,
            complexityScore: 0,
            claimsGenerated: 0,
            theoremsProven: 0
        };
        newGenome.complexityScore = ASTGenomeFactory.getComplexity(newGenome);
        return newGenome;
    }

    /**
     * Get complexity score for an AST genome
     */
    static getComplexity(genome: MathGenome): number {
        if (genome.type !== 'ast') return 0;

        const data = genome.data as ASTGenomeData;
        const countNodes = (expr: MathExpression): number => {
            if (expr.type === 'ATOM') return 1;
            let count = 1;
            if (expr.left) count += countNodes(expr.left);
            if (expr.right) count += countNodes(expr.right);
            return count;
        };

        const strategyNodes = countNodes(data.solverStrategy);
        const templateNodes = countNodes(data.conjectureTemplate);

        // Normalize to 0-1 range (assuming max ~50 nodes)
        return Math.min(1, (strategyNodes + templateNodes) / 50);
    }

    /**
     * Helper to clone expression (exposed for ASTMutator compatibility)
     */
    private static cloneExpr(expr: MathExpression): MathExpression {
        if (expr.type === 'ATOM') {
            return { type: 'ATOM', value: expr.value };
        }
        return {
            type: 'OP',
            op: expr.op,
            left: expr.left ? this.cloneExpr(expr.left) : undefined,
            right: expr.right ? this.cloneExpr(expr.right) : undefined
        };
    }

    /**
     * Mutate an AST genome using LLM when available
     * Falls back to standard AST mutation if LLM is unavailable
     * @returns Promise with mutated genome and whether LLM was used
     */
    static async mutateWithLLM(
        genome: MathGenome,
        prng: PRNG
    ): Promise<{ genome: MathGenome; usedLLM: boolean }> {
        if (genome.type !== 'ast') {
            throw new Error('Cannot AST-mutate non-AST genome');
        }

        // Dynamic import to avoid circular dependencies
        const { getLLMMutationService } = await import('./LLMMutationService');
        const llmService = getLLMMutationService();

        const astData = genome.data as ASTGenomeData;
        let usedLLM = false;

        // Try LLM mutation for solver strategy
        const mutationTypes: ('generalize' | 'simplify' | 'extend' | 'analogize')[] =
            ['generalize', 'simplify', 'extend', 'analogize'];
        const selectedType = mutationTypes[prng.nextInt(0, mutationTypes.length)];

        const strategyResult = await llmService.mutate(
            astData.solverStrategy,
            selectedType,
            prng
        );

        if (strategyResult.usedLLM) usedLLM = true;

        // Standard mutation for template and biases
        const mutator = new ASTMutator(prng);

        const newAstData: ASTGenomeData = {
            solverStrategy: strategyResult.expr,
            conjectureTemplate: mutator.mutate(astData.conjectureTemplate, 0.2),
            mutationBias: {
                preferVariables: Math.max(0, Math.min(1,
                    astData.mutationBias.preferVariables + (prng.next() - 0.5) * 0.1)),
                preferComplex: Math.max(0, Math.min(1,
                    astData.mutationBias.preferComplex + (prng.next() - 0.5) * 0.1)),
                operatorWeights: { ...astData.mutationBias.operatorWeights }
            }
        };

        // Mutate one operator weight
        const ops = Object.keys(newAstData.mutationBias.operatorWeights) as MathOperator[];
        const opToMutate = ops[prng.nextInt(0, ops.length)];
        newAstData.mutationBias.operatorWeights[opToMutate] = Math.max(0, Math.min(1,
            newAstData.mutationBias.operatorWeights[opToMutate] + (prng.next() - 0.5) * 0.2
        ));

        const newGenome: MathGenome = {
            id: `ast-llm-${genome.id.substring(0, 6)}-${prng.nextInt(0, 1000)}`,
            type: 'ast',
            data: newAstData,
            solvedCount: 0,
            complexityScore: 0,
            claimsGenerated: 0,
            theoremsProven: 0
        };
        newGenome.complexityScore = ASTGenomeFactory.getComplexity(newGenome);

        return {
            genome: newGenome,
            usedLLM
        };
    }
    public static createRandomNeuralGuide(prng: PRNG): NeuralGenomeData {
        const config: NeuralGuideConfig = {
            inputSize: 7, // Features from featurize()
            hiddenSizes: [8, 4],
            outputSize: 1,
            learningRate: 0.01
        };
        const guide = new NeuralGuide(config, prng.next());
        return {
            config,
            weights: guide.serialize()
        };
    }
}

