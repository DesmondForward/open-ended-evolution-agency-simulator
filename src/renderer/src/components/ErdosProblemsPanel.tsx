import React, { useMemo, useState } from 'react';
import 'katex/dist/katex.min.css';
import { BlockMath, InlineMath } from 'react-katex';
import { useSimulationStore } from '../store/simulationStore';

type ErdosDashboardProblem = {
    id: string;
    title: string;
    description: string;
    status: 'in progress' | 'solved';
    timestamp: string;
    steps: string[];
    agents: Array<{ name: string; id: string }>;
    copy_action: string;
};

const PROBLEM_MATH: Record<string, { statement: string; progressMetric: string; explanation: string }> = {
    'erdos-distinct-distances': {
        statement: 'D(n) \\ge c\\,\\frac{n}{\\sqrt{\\log n}}',
        progressMetric: 'Q_t = 0.45\\bar c_t + 0.45\\bar r_t + 0.10\\bar \\ell_t + 0.15U + \\varepsilon_t',
        explanation: 'The agents try to tighten asymptotic lower bounds on distinct distances and report quality updates against the current threshold.'
    },
    'erdos-discrepancy': {
        statement: '\\max_{a,d,k}\\left|\\sum_{j=0}^{k-1} x_{a+jd}\\right| \\to \\infty',
        progressMetric: 'Q_t \\ge \\theta_t,\\quad \\theta_t = 0.85\\,\\mathrm{difficulty}\\cdot(1-0.2\\,\\mathrm{collab})',
        explanation: 'Teams search for stronger discrepancy-growth guarantees over arithmetic progressions and track when quality crosses the solve threshold.'
    },
    'erdos-turan-cubes': {
        statement: '\\pi\\!\\left(K_4^{(3)}\\right)=\\lim_{n\\to\\infty}\\frac{\\mathrm{ex}(n,K_4^{(3)})}{\\binom n3}',
        progressMetric: '\\Delta_t = Q_t-\\theta_t',
        explanation: 'Work is focused on extremal hypergraph density estimates, with positive margin \\((\\Delta_t>0)\\) indicating a solved state.'
    },
    'erdos-faber-lovasz': {
        statement: '\\chi(H)\\le n',
        progressMetric: 'Q_t = f(\\text{creativity},\\text{rigor},\\text{collaboration},U)',
        explanation: 'Agencies test coloring constructions and intersection-structure constraints while explaining each generation’s progress.'
    },
    'erdos-unit-distance': {
        statement: 'u(n)=O\\!\\left(n^{1+\\epsilon}\\right)\\;? ',
        progressMetric: '\\text{Solved if }Q_t\\ge\\theta_t',
        explanation: 'The viewer highlights conjectural unit-distance bounds and whether the current generation has reached the required quality.'
    },
    'erdos-szemeredi-sum-product': {
        statement: '\\max\\{|A+A|,|A\\cdot A|\\} \\ge c|A|^{1+\\delta}',
        progressMetric: '\\delta_t \\uparrow \\text{ as proof quality improves}',
        explanation: 'Agents iterate additive/multiplicative argument templates and show qualitative exponent-improvement momentum.'
    },
    'erdos-hajnal': {
        statement: '\\omega(G)\\alpha(G) \\ge n^{1+\\varepsilon_H}',
        progressMetric: '\\varepsilon_{H,t} \\approx g(Q_t)',
        explanation: 'Generated steps explain how forbidden-subgraph structure may amplify homogeneous-set exponents.'
    },
    'erdos-moser': {
        statement: '|\\Sigma(A)| \\ge c\\,|A|^2',
        progressMetric: '\\text{Gap}_t = \\theta_t-Q_t',
        explanation: 'Contributors pursue stronger subset-sum lower bounds, shrinking the gap until the problem is marked solved.'
    }
};

const panelStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
};

const ErdosProblemsPanel: React.FC = () => {
    const getErdosProblemsForDashboard = useSimulationStore(state => state.getErdosProblemsForDashboard);
    const currentScenarioId = useSimulationStore(state => state.currentScenarioId);
    const generation = useSimulationStore(state => state.currentState.generation);
    const cycle = useSimulationStore(state => {
        const scenarioState = state.scenarios.erdos?.getState ? state.scenarios.erdos.getState() : null;
        return scenarioState?.cycle ?? 1;
    });
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const problems = useMemo<ErdosDashboardProblem[]>(() => {
        if (currentScenarioId !== 'erdos') return [];
        return getErdosProblemsForDashboard();
    }, [currentScenarioId, generation, getErdosProblemsForDashboard, cycle]);

    const handleCopy = async (problem: ErdosDashboardProblem) => {
        try {
            await navigator.clipboard.writeText(problem.copy_action);
            setCopiedId(problem.id);
            window.setTimeout(() => setCopiedId(prev => (prev === problem.id ? null : prev)), 1200);
        } catch (error) {
            console.warn('Failed to copy markdown summary:', error);
        }
    };

    return (
        <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.9rem' }}>Erdos Problem Dashboard</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{problems.filter(p => p.status === 'in progress').length} active / {problems.length} listed</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                Catalog source: <code>teorth/erdosproblems</code>. Generations represent iterative proof-search cycles; after all listed problems are solved, the scenario starts a new verification cycle to refine rigor and reproducibility.
            </div>

            {problems.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>[No open problem is currently active.]</div>
            ) : (
                problems.map(problem => {
                    const math = PROBLEM_MATH[problem.id];

                    return (
                        <div key={problem.id} style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '10px', display: 'grid', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                <strong style={{ fontSize: '0.85rem' }}>{problem.title}</strong>
                                <span style={{ fontSize: '0.72rem', color: problem.status === 'solved' ? '#41d17d' : 'var(--color-text-secondary)' }}>{problem.status}</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{problem.description}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>Updated: {problem.timestamp}</div>

                            {math && (
                                <div style={{ padding: '8px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-bg)' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Problem statement (KaTeX)</div>
                                    <BlockMath math={math.statement} />
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Progress signal</div>
                                    <BlockMath math={math.progressMetric} />
                                    <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>{math.explanation}</div>
                                </div>
                            )}

                            <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>
                                Agents proceed in chronological order and work one open problem at a time. Current generation: <InlineMath math={`t=${generation}`} /> in cycle <InlineMath math={`c=${cycle}`} />
                            </div>

                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Steps</div>
                                {problem.steps.length ? (
                                    <ol style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '0.76rem' }}>
                                        {problem.steps.map((step, index) => <li key={`${problem.id}-step-${index}`}>{step}</li>)}
                                    </ol>
                                ) : (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>No steps yet.</div>
                                )}
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Contributors</div>
                                {problem.agents.length ? (
                                    <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '0.76rem' }}>
                                        {problem.agents.map(agent => <li key={`${problem.id}-${agent.id}`}>{agent.name} ({agent.id})</li>)}
                                    </ul>
                                ) : (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>No contributors listed.</div>
                                )}
                            </div>
                            <button
                                onClick={() => handleCopy(problem)}
                                style={{
                                    justifySelf: 'start',
                                    background: 'var(--color-primary)',
                                    border: 'none',
                                    color: 'var(--color-bg)',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                }}
                            >
                                {copiedId === problem.id ? 'Copied!' : 'Copy proof/disprove'}
                            </button>
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default ErdosProblemsPanel;
