import { PRNG } from '../../../common/prng';
import { DEFAULT_AGENT_CONFIG } from './AgentTypes';
import { AgentLogic } from './AgentLogic';
import * as AgencyMetrics from '../../metrics/AgencyMetrics';
import { SimulationLogger } from '../../logging/SimulationLogger';
export class AgentsScenario {
    metadata = {
        id: 'agents',
        name: 'Emergent Task Decomposition',
        description: 'Agents evolve hierarchical plans and reusable skills to solve shifting tasks.',
        version: '0.1.0',
        type: 'agents'
    };
    state;
    config;
    prng;
    eventQueue = [];
    // Drift tracking
    currentRequirements;
    constructor() {
        this.prng = new PRNG(Date.now());
        this.config = { ...DEFAULT_AGENT_CONFIG };
        this.state = this.getEmptyState();
        this.currentRequirements = this.getDefaultRequirements();
    }
    getEmptyState() {
        return {
            generation: 0,
            agents: [],
            currentTasks: [],
            metrics: {
                C: 0, D: 0, A: 0, U: 0, alertRate: 0,
                skillReuseRate: 0,
                averageToolboxSize: 0,
                taskSuccessRate: 0,
                H: 0, E: 0, BV: 0, AFG: 0, EI: 0
            }
        };
    }
    getDefaultRequirements() {
        return {
            NAVIGATE: 30,
            COMPUTE: 10,
            MANIPULATE: 20,
            COMMUNICATE: 5
        };
    }
    initialize(seed, config) {
        this.prng.setSeed(seed);
        if (config)
            this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
        this.state = this.getEmptyState();
        this.currentRequirements = this.getDefaultRequirements();
        // Spawn Initial Pop
        for (let i = 0; i < this.config.populationSize; i++) {
            this.state.agents.push(AgentLogic.random(this.prng, 0));
        }
    }
    updateConfig(config) {
        const next = { ...this.config, ...config };
        if (!Number.isFinite(next.populationSize) || next.populationSize < 1) {
            next.populationSize = 1;
        }
        if (!Number.isFinite(next.tasksPerGen) || next.tasksPerGen < 1) {
            next.tasksPerGen = 1;
        }
        next.populationSize = Math.floor(next.populationSize);
        next.tasksPerGen = Math.floor(next.tasksPerGen);
        this.config = next;
    }
    step(control) {
        this.state.generation++;
        if (this.state.agents.length === 0) {
            for (let i = 0; i < this.config.populationSize; i++) {
                this.state.agents.push(AgentLogic.random(this.prng, this.state.generation));
            }
        }
        // 1. Task Drift
        // U drives the drift rate? Or drift magnitude?
        const drift = control.U * this.config.driftRate;
        // Randomly adjust one requirement baseline
        const types = ['NAVIGATE', 'COMPUTE', 'MANIPULATE', 'COMMUNICATE'];
        if (this.prng.next() < 0.2) {
            const target = types[this.prng.nextInt(0, types.length)];
            // Drift up or down
            const change = (this.prng.next() - 0.5) * 20 * drift;
            this.currentRequirements[target] = Math.max(0, this.currentRequirements[target] + change);
            if (Math.abs(change) > 5) {
                // Notable shift
            }
        }
        // 2. Generate Tasks
        this.state.currentTasks = [];
        for (let i = 0; i < this.config.tasksPerGen; i++) {
            // Jitter around current requirements
            const taskReqs = {};
            types.forEach(t => {
                taskReqs[t] = Math.max(0, this.currentRequirements[t] + (this.prng.next() - 0.5) * 10);
            });
            this.state.currentTasks.push({
                id: `task-${this.state.generation}-${i}`,
                requirements: taskReqs,
                deadline: 100,
                driftFactor: drift
            });
        }
        // 3. Evaluate Agents
        let totalSuccess = 0;
        let totalSkillUsage = 0;
        let totalActions = 0;
        const evaluatedAgents = this.state.agents.map(entity => {
            const logic = new AgentLogic(entity);
            let score = 0;
            let agentTotalCost = 0;
            this.state.currentTasks.forEach(task => {
                const result = logic.solve(task, this.prng);
                if (result.success)
                    score++;
                agentTotalCost += result.cost;
                totalActions += 1; // Or sum of requirements? 
                totalSkillUsage += result.usedSkills; // Logic returns count of skills used
            });
            entity.score = score;
            totalSuccess += score;
            // Calculate Agent-Specific Novelty (Behavioral Variance)
            let novelty = 0;
            if (entity.previousPolicyState) {
                const currentPolicy = logic.getPolicyState();
                novelty = AgencyMetrics.computeBehavioralVariance(entity.previousPolicyState, currentPolicy);
            }
            // Log to Lattice
            SimulationLogger.logAgent({
                generation: this.state.generation,
                agentId: entity.id,
                lineageId: entity.lineageId,
                energy: agentTotalCost,
                novelty: novelty,
                fitness: score
            });
            return logic;
        });
        // 4. Selection (Tournament or Elite)
        // Sort by score
        evaluatedAgents.sort((a, b) => b.entity.score - a.entity.score);
        const survivorCount = Math.max(1, Math.floor(this.config.populationSize * 0.4));
        const survivors = evaluatedAgents.slice(0, Math.min(survivorCount, evaluatedAgents.length));
        const nextGen = [];
        // Elitism: keep survivors
        survivors.forEach(l => nextGen.push(l.entity)); // Keep state? Or reset?
        // Reset score for next gen
        nextGen.forEach(e => e.score = 0);
        // Fill with mutants
        while (nextGen.length < this.config.populationSize) {
            const parent = survivors[this.prng.nextInt(0, survivors.length)];
            const child = parent.mutate(this.prng, this.state.generation);
            nextGen.push(child);
        }
        this.state.agents = nextGen;
        // 5. Metrics
        const totalTasks = this.config.populationSize * this.config.tasksPerGen;
        const successRate = totalSuccess / Math.max(1, totalTasks);
        // Skill Reuse Rate = (Skills Used / Total Actions that could use skills)
        // Wait, 'usedSkills' is count of skills used per task. 
        // A task has N reqs. If we used M skills, reuse rate implies we didn't just 'solve raw'.
        // Let's normalize: Skill Usage per Task Solve?
        const reuse = totalActions > 0 ? totalSkillUsage / totalActions : 0;
        const avgToolbox = nextGen.reduce((acc, a) => acc + a.skills.length, 0) / nextGen.length;
        // Agency => Success Rate * Reuse Rate (Efficiency)
        const newA = successRate * (0.5 + 1.5 * reuse); // Bonus for intelligent reuse
        // --- Agency Metrics Calculation ---
        // 1. World Uncertainty (H)
        const H = AgencyMetrics.computeEntropy(this.state.currentTasks);
        // 2. Energy Spent (E) - Total complexity of tasks attempted (or resolved)
        // Using totalActions as a proxy for "steps taken" or energy spent
        const E = totalActions;
        // 3. Behavioral Variance (BV)
        // Average distance between each agent's previous policy and current policy
        let totalBV = 0;
        this.state.agents.forEach(agent => {
            if (agent.previousPolicyState) {
                const currentPolicy = new AgentLogic(agent).getPolicyState();
                totalBV += AgencyMetrics.computeBehavioralVariance(agent.previousPolicyState, currentPolicy);
            }
        });
        const avgBV = this.state.agents.length > 0 ? totalBV / this.state.agents.length : 0;
        // 4. Adaptive Feedback Gain (AFG)
        // We need delta Score (improvement from previous gen). 
        // We don't track total score history in state for simplicity, let's approximate:
        // AFG = Average BV / (Change in Success Rate + epsilon)
        const prevSuccessRate = this.state.metrics.taskSuccessRate || 0.01;
        const deltaSuccess = successRate - prevSuccessRate;
        const AFG = AgencyMetrics.computeFeedbackGain(avgBV, deltaSuccess);
        // 5. Energy Efficiency (EE)
        const prevH = this.state.metrics.H || H; // If first step, delta is 0
        const EE = AgencyMetrics.computeEnergyEfficiency(prevH, H, E);
        // 6. Emergent Intention (EI)
        const EI = AgencyMetrics.computeEmergentIntention(EE, AFG, avgBV, successRate);
        // Update State Metrics
        const alpha = 0.1;
        this.state.metrics.A = this.state.metrics.A * (1 - alpha) + newA * alpha; // Keep legacy A for now
        this.state.metrics.skillReuseRate = reuse;
        this.state.metrics.averageToolboxSize = avgToolbox;
        this.state.metrics.taskSuccessRate = successRate;
        this.state.metrics.U = control.U;
        // New Metrics
        this.state.metrics.H = H;
        this.state.metrics.E = E;
        this.state.metrics.BV = avgBV;
        this.state.metrics.AFG = AFG;
        this.state.metrics.EI = EI;
        if (this.state.metrics.EI > 0.8) {
            this.eventQueue.push({
                type: 'threshold_crossed',
                timestamp: this.state.generation,
                data: { A: this.state.metrics.A },
                message: "High Agency: Efficient Skill Reuse Detected"
            });
            // Log the best agent
            // Find max fitness or max novelty agent
            if (this.state.agents.length > 0) {
                const bestAgent = this.state.agents.reduce((prev, current) => (prev.score > current.score) ? prev : current);
                this.eventQueue.push({
                    type: 'agent_emerged',
                    timestamp: this.state.generation,
                    data: {
                        id: bestAgent.id,
                        timestamp: new Date().toISOString(),
                        name: `Agent-${bestAgent.id.substring(0, 5)}`,
                        description: `High Agency Agent (A=${this.state.metrics.A.toFixed(2)}) from Emergent Task Decomposition Scenario.`,
                        tags: ['High-Agency', 'Agents-Scenario'],
                        generation: this.state.generation,
                        metrics: {
                            A: this.state.metrics.A,
                            C: this.state.metrics.C,
                            D: this.state.metrics.D,
                            alertRate: this.state.metrics.alertRate
                        },
                        parameters: this.config, // Save config as parameters
                        environmentalControl: { U: this.state.metrics.U },
                        historySnippet: [], // TODO: Track agent specific history?
                        validationMetrics: {
                            stateBoundsViolationRate: 0,
                            diversityFloorViolationFraction: 0,
                            controlBoundsViolationRate: 0
                        },
                        runContext: {
                            bestAgencySoFar: this.state.metrics.A
                        }
                    },
                    message: "New Agent Added to Library"
                });
            }
        }
    }
    getMetrics() {
        return {
            generation: this.state.generation,
            C: this.state.metrics.C,
            D: this.state.metrics.D,
            A: this.state.metrics.A,
            U: this.state.metrics.U,
            alertRate: this.state.metrics.alertRate
        };
    }
    getState() { return this.state; }
    serialize() { return JSON.stringify(this.state); }
    deserialize(json) { this.state = JSON.parse(json); }
    getEvents() { return [...this.eventQueue]; }
    clearEvents() { this.eventQueue = []; }
}
