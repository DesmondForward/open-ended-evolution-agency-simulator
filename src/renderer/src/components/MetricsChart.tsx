import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';
import { useSimulationStore } from '../store/simulationStore';

const MetricsChart: React.FC = () => {
    const telemetry = useSimulationStore(state => state.telemetry);
    const A_alert = useSimulationStore(state => state.parameters.A_alert);

    return (
        <div className="card" style={{ height: '400px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 600 }}>Real-time MACROSCOPIC Dynamics</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={telemetry}
                        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#2d2d55" vertical={false} />
                        <XAxis
                            dataKey="generation"
                            stroke="#a0a0b0"
                            tick={{ fill: '#a0a0b0' }}
                            label={{ value: 'Generations', position: 'insideBottomRight', offset: -5, fill: '#a0a0b0' }}
                            type="number"
                            domain={['auto', 'auto']}
                            allowDecimals={false}
                        />
                        <YAxis
                            stroke="#a0a0b0"
                            tick={{ fill: '#a0a0b0' }}
                            domain={[0, 1]}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#13132b', borderColor: '#2d2d55', color: '#e0e0e0' }}
                            itemStyle={{ padding: 0 }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />

                        <ReferenceLine y={A_alert} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Agency Threshold', fill: '#f43f5e', position: 'insideTopRight' }} />

                        <Line
                            type="monotone"
                            dataKey="C"
                            name="Complexity (C)"
                            stroke="var(--color-complexity)"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false} // Performance optimization for frequent updates
                        />
                        <Line
                            type="monotone"
                            dataKey="D"
                            name="Diversity (D)"
                            stroke="var(--color-diversity)"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="A"
                            name="Agency (A)"
                            stroke="var(--color-agency)"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default MetricsChart;
