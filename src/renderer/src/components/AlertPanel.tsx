import React, { useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { AlertOctagon, CheckCircle } from 'lucide-react';

const AlertPanel: React.FC = () => {
    const alerts = useSimulationStore(state => state.alerts);
    const currentState = useSimulationStore(state => state.currentState);
    const A_alert = useSimulationStore(state => state.parameters.A_alert);

    const alertsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of alerts list
    useEffect(() => {
        alertsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [alerts]);

    const isAlerting = currentState.A >= A_alert;

    return (
        <div className={`card ${isAlerting ? 'alert-pulse' : ''}`} style={{ height: '300px', padding: '16px', display: 'flex', flexDirection: 'column', borderColor: isAlerting ? 'var(--color-alert)' : 'var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Agency Detection Logs</h3>
                {isAlerting && (
                    <span style={{
                        background: '#f43f5e',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                    }}>
                        EMERGENCE DETECTED
                    </span>
                )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {alerts.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-secondary)', opacity: 0.5 }}>
                        <CheckCircle size={32} style={{ marginBottom: '8px' }} />
                        <span>No agency threshold crossings detected yet.</span>
                    </div>
                ) : (
                    alerts.map((alert) => (
                        <div key={alert.id} style={{
                            background: 'rgba(255,255,255,0.05)',
                            padding: '10px',
                            borderRadius: 'var(--radius-sm)',
                            borderLeft: '3px solid var(--color-alert)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <span style={{ fontWeight: 600, color: 'var(--color-alert)' }}>AGENCY THRESHOLD CROSSED</span>
                                <span style={{ opacity: 0.7 }}>Gen: {alert.generation.toFixed(1)}</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', marginTop: '4px', opacity: 0.8 }}>
                                Detected Agency Level: {alert.agencyLevel.toFixed(3)}
                            </div>
                        </div>
                    ))
                )}
                <div ref={alertsEndRef} />
            </div>
        </div>
    );
};

export default AlertPanel;
