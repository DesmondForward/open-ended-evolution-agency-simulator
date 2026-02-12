import React, { useState } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { ChevronDown, ChevronUp, Info, Settings } from 'lucide-react';
import { SimulationParameters } from '../simulation/types';

const ParameterPanel: React.FC = () => {
    const { parameters, updateParameters, scenarioMetadata, scenarioConfigs, updateScenarioConfig } = useSimulationStore();
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = () => setIsOpen(!isOpen);

    const handleChange = (key: keyof SimulationParameters, value: number) => {
        updateParameters({ [key]: value });
    };

    const ParamInput = ({ label, paramKey, min, max, step, tooltip }: { label: string, paramKey: keyof SimulationParameters, min: number, max: number, step: number, tooltip?: string }) => (
        <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '2px' }}>
                <span style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {label}
                    {tooltip && <Info size={12} color="var(--color-text-secondary)" title={tooltip} />}
                </span>
                <span>{(parameters[paramKey] as number).toFixed(3)}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={parameters[paramKey] as number}
                onChange={(e) => handleChange(paramKey, parseFloat(e.target.value))}
            />
        </div>
    );

    const ScenarioInput = ({ label, value, min, max, step, tooltip, onChange }: { label: string; value: number | boolean; min?: number; max?: number; step?: number; tooltip?: string; onChange: (next: number | boolean) => void }) => (
        <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '2px' }}>
                <span style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {label}
                    {tooltip && <Info size={12} color="var(--color-text-secondary)" title={tooltip} />}
                </span>
                <span>{typeof value === 'number' ? value.toFixed(2) : value ? 'On' : 'Off'}</span>
            </div>
            {typeof value === 'number' ? (
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                />
            ) : (
                <button
                    onClick={() => onChange(!value)}
                    style={{
                        width: '100%',
                        padding: '6px',
                        background: value ? 'var(--color-surface-hover)' : 'transparent',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-text-primary)',
                        cursor: 'pointer'
                    }}
                >
                    {value ? 'Enabled' : 'Disabled'}
                </button>
            )}
        </div>
    );

    return (
        <div className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div
                onClick={toggleOpen}
                style={{
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: 'var(--color-surface)',
                    borderBottom: isOpen ? '1px solid var(--color-border)' : 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Settings size={18} />
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>
                        {scenarioMetadata.type === 'sde' ? 'SDE Parameters' : `${scenarioMetadata.name} Config`}
                    </h3>
                </div>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>

            {isOpen && (
                <div style={{ padding: '16px', background: 'var(--color-bg)', maxHeight: '400px', overflowY: 'auto' }}>
                    {scenarioMetadata.type === 'sde' && (
                        <>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Coupling Rates</h4>
                            <ParamInput label="Diversity -> Complexity (k_CD)" paramKey="k_CD" min={0} max={0.5} step={0.01} tooltip="How strongly diversity drives complexity growth." />
                            <ParamInput label="Complexity -> Agency (k_AC)" paramKey="k_AC" min={0} max={0.5} step={0.01} tooltip="How strongly complexity boosts agency." />
                            <ParamInput label="Agency -> Difficulty (k_AU)" paramKey="k_AU" min={0} max={1.0} step={0.01} tooltip="How strongly U amplifies agency gains." />

                            <h4 style={{ margin: '16px 0 8px 0', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Growth & Decay</h4>
                            <ParamInput label="Complexity Decay (k_C_decay)" paramKey="k_C_decay" min={0.1} max={0.5} step={0.01} tooltip="Natural complexity decay rate." />
                            <ParamInput label="Diversity Growth (k_D_growth)" paramKey="k_D_growth" min={0.1} max={0.5} step={0.01} tooltip="Intrinsic diversity growth rate." />
                            <ParamInput label="Diversity Decay (k_D_decay)" paramKey="k_D_decay" min={0.1} max={0.5} step={0.01} tooltip="Diversity saturation decay." />
                            <ParamInput label="Agency Decay (k_A_decay)" paramKey="k_A_decay" min={0.1} max={0.5} step={0.01} tooltip="Agency decay without sustained adaptation." />

                            <h4 style={{ margin: '16px 0 8px 0', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Control Physics</h4>
                            <ParamInput label="Control -> Diversity Decay (k_DU)" paramKey="k_DU" min={0} max={1.0} step={0.01} tooltip="How strongly U suppresses diversity." />
                            <ParamInput label="Control -> Stimulation (k_U)" paramKey="k_U" min={0} max={0.5} step={0.01} tooltip="How strongly U stimulates complexity." />

                            <h4 style={{ margin: '16px 0 8px 0', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Stochasticity (Noise)</h4>
                            <ParamInput label="Sigma Complexity" paramKey="sigma_C" min={0} max={0.2} step={0.01} tooltip="Noise scale for complexity." />
                            <ParamInput label="Sigma Diversity" paramKey="sigma_D" min={0} max={0.2} step={0.01} tooltip="Noise scale for diversity." />
                            <ParamInput label="Sigma Agency" paramKey="sigma_A" min={0} max={0.2} step={0.01} tooltip="Noise scale for agency." />

                            <h4 style={{ margin: '16px 0 8px 0', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Alert System</h4>
                            <ParamInput label="Threshold (A_alert)" paramKey="A_alert" min={0.1} max={0.9} step={0.05} tooltip="Alert threshold for agency." />
                        </>
                    )}

                    {scenarioMetadata.type === 'math' && (
                        <>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Population & Tasks</h4>
                            <ScenarioInput label="Population Size" value={scenarioConfigs.math.populationSize} min={10} max={200} step={1} tooltip="Number of solver agents." onChange={(value) => updateScenarioConfig({ populationSize: value as number })} />
                            <ScenarioInput label="Tasks Per Gen" value={scenarioConfigs.math.tasksPerGen} min={5} max={100} step={1} tooltip="Number of tasks generated per generation." onChange={(value) => updateScenarioConfig({ tasksPerGen: value as number })} />
                            <ScenarioInput label="Mutation Rate" value={scenarioConfigs.math.mutationRate} min={0.01} max={0.5} step={0.01} tooltip="Genome mutation rate for solver evolution." onChange={(value) => updateScenarioConfig({ mutationRate: value as number })} />

                            <h4 style={{ margin: '16px 0 8px 0', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Novelty & Verification</h4>
                            <ScenarioInput label="Difficulty Scale" value={scenarioConfigs.math.difficultyScale} min={0.5} max={2.0} step={0.05} tooltip="Scales task difficulty relative to U." onChange={(value) => updateScenarioConfig({ difficultyScale: value as number })} />
                            <ScenarioInput label="Novelty Threshold" value={scenarioConfigs.math.noveltyThreshold} min={0.1} max={0.9} step={0.05} tooltip="Minimum novelty for theorem acceptance." onChange={(value) => updateScenarioConfig({ noveltyThreshold: value as number })} />
                            <ScenarioInput label="Verification Budget" value={scenarioConfigs.math.verificationBudget} min={10} max={500} step={10} tooltip="Max formal verification attempts per generation." onChange={(value) => updateScenarioConfig({ verificationBudget: value as number })} />
                            <ScenarioInput label="Enable Theorems" value={scenarioConfigs.math.enableTheorems} tooltip="Enable theorem generation and proof attempts." onChange={(value) => updateScenarioConfig({ enableTheorems: value as boolean })} />
                        </>
                    )}

                    {scenarioMetadata.type === 'alignment' && (
                        <>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Population Dynamics</h4>
                            <ScenarioInput label="Population Size" value={scenarioConfigs.alignment.populationSize} min={5} max={100} step={1} tooltip="Number of agents in the safety sandbox." onChange={(value) => updateScenarioConfig({ populationSize: value as number })} />
                            <ScenarioInput label="Mutation Rate" value={scenarioConfigs.alignment.mutationRate} min={0.01} max={0.3} step={0.01} tooltip="Policy mutation rate." onChange={(value) => updateScenarioConfig({ mutationRate: value as number })} />
                            <ScenarioInput label="Base Resource Rate" value={scenarioConfigs.alignment.baseResourceRate} min={0.1} max={5} step={0.1} tooltip="Baseline resource availability." onChange={(value) => updateScenarioConfig({ baseResourceRate: value as number })} />
                        </>
                    )}

                    {scenarioMetadata.type === 'bio' && (
                        <>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Ecology Controls</h4>
                            <ScenarioInput label="Initial Population" value={scenarioConfigs.bio.initialPopulation} min={10} max={200} step={1} tooltip="Starting population size." onChange={(value) => updateScenarioConfig({ initialPopulation: value as number })} />
                            <ScenarioInput label="Max Population" value={scenarioConfigs.bio.maxPopulation} min={100} max={2000} step={10} tooltip="Carrying capacity for the environment." onChange={(value) => updateScenarioConfig({ maxPopulation: value as number })} />
                            <ScenarioInput label="Mutation Rate" value={scenarioConfigs.bio.mutationRate} min={0.01} max={0.5} step={0.01} tooltip="Genetic mutation rate per reproduction." onChange={(value) => updateScenarioConfig({ mutationRate: value as number })} />
                            <ScenarioInput label="Energy Per Tick" value={scenarioConfigs.bio.energyPerTick} min={100} max={5000} step={50} tooltip="Incoming energy per tick." onChange={(value) => updateScenarioConfig({ energyPerTick: value as number })} />
                            <ScenarioInput label="Mineral Influx" value={scenarioConfigs.bio.mineralInflux} min={10} max={500} step={10} tooltip="Mineral influx rate." onChange={(value) => updateScenarioConfig({ mineralInflux: value as number })} />
                        </>
                    )}

                    {scenarioMetadata.type === 'agents' && (
                        <>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>ETD Controls</h4>
                            <ScenarioInput label="Population Size" value={scenarioConfigs.agents.populationSize} min={5} max={100} step={1} tooltip="Number of agents in the ETD arena." onChange={(value) => updateScenarioConfig({ populationSize: value as number })} />
                            <ScenarioInput label="Tasks Per Gen" value={scenarioConfigs.agents.tasksPerGen} min={5} max={50} step={1} tooltip="Tasks generated per generation." onChange={(value) => updateScenarioConfig({ tasksPerGen: value as number })} />
                            <ScenarioInput label="Base Task Difficulty" value={scenarioConfigs.agents.baseTaskDifficulty} min={5} max={100} step={1} tooltip="Baseline difficulty for tasks." onChange={(value) => updateScenarioConfig({ baseTaskDifficulty: value as number })} />
                            <ScenarioInput label="Drift Rate" value={scenarioConfigs.agents.driftRate} min={0.01} max={0.5} step={0.01} tooltip="How quickly task distributions drift." onChange={(value) => updateScenarioConfig({ driftRate: value as number })} />
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ParameterPanel;
