
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SavedAgent, SimulationState, SimulationParameters, DEFAULT_INITIAL_STATE } from '../simulation/types';
import { eulerMaruyamaStep } from '../simulation/sdeEngine';
import { X } from 'lucide-react';

interface AgentPreviewModalProps {
    agent: SavedAgent;
    onClose: () => void;
}

const AgentPreviewModal: React.FC<AgentPreviewModalProps> = ({ agent, onClose }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [stats, setStats] = useState<SimulationState>({ ...DEFAULT_INITIAL_STATE, A: agent.metrics.A, C: agent.metrics.C, D: agent.metrics.D });

    // Shader code for the "Living Orb"
    const vertexShader = `
        uniform float uTime;
        uniform float uComplexity;
        uniform float uAgency;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying float vDisplacement;

        // Simplex noise function (simplified)
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        float snoise(vec3 v) {
            const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
            const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 = v - i + dot(i, C.xxx) ;
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;
            i = mod289(i);
            vec4 p = permute( permute( permute(
                        i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
            float n_ = 0.142857142857;
            vec3  ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );
            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
            vec3 p0 = vec3(a0.xy,h.x);
            vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z);
            vec3 p3 = vec3(a1.zw,h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
        }

        void main() {
            vUv = uv;
            vNormal = normal;
            
            // Complexity drives the noise frequency and amplitude
            float noiseFreq = 1.0 + uComplexity * 3.0;
            float noiseAmp = 0.1 + uComplexity * 0.4;
            
            // Agency makes the pulse faster and more coherent
            float pulseSpeed = 1.0 + uAgency * 2.0;
            
            float noiseVal = snoise(vec3(position.x * noiseFreq + uTime * 0.5, position.y * noiseFreq, position.z * noiseFreq + uTime * 0.2));
            float pulse = sin(uTime * pulseSpeed) * 0.05 * uAgency;
            
            vDisplacement = noiseVal * noiseAmp + pulse;
            vec3 newPosition = position + normal * vDisplacement;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
    `;

    const fragmentShader = `
        uniform float uDiversity;
        uniform float uAgency;
        varying float vDisplacement;
        varying vec3 vNormal;

        // HSL to RGB helper
        vec3 hueToRgb(float h) {
            vec3 col = vec3(abs(h * 6.0 - 3.0) - 1.0, 2.0 - abs(h * 6.0 - 2.0), 2.0 - abs(h * 6.0 - 4.0));
            return clamp(col, 0.0, 1.0);
        }

        void main() {
            // Diversity drives the base Hue
            // We map D (0-1) to a portion of the hue spectrum (e.g., Blue to Red/Gold)
            float baseHue = 0.6 - uDiversity * 0.5; // Blue (0.6) to Orange (0.1)
            
            vec3 baseColor = hueToRgb(baseHue);
            
            // Agency adds a high-energy "inner glow" or brightness
            float glow = smoothstep(-0.2, 0.5, vDisplacement) * uAgency;
            
            // Rim lighting for 3D effect
            vec3 viewDir = vec3(0.0, 0.0, 1.0); // Simplified view direction
            float rim = 1.0 - max(dot(vNormal, viewDir), 0.0);
            rim = pow(rim, 3.0);
            
            vec3 finalColor = baseColor + vec3(1.0, 1.0, 0.8) * glow * 1.5 + vec3(0.5, 0.8, 1.0) * rim * 0.5;
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    useEffect(() => {
        if (!containerRef.current) return;

        // --- Init Three.js ---
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const scene = new THREE.Scene();
        // scene.background = new THREE.Color(0x0a0a1a); // Let container background show through for transparency if desired, or set dark

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.z = 4;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);

        // --- Create Sphere ---
        const geometry = new THREE.IcosahedronGeometry(1, 64);
        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uComplexity: { value: stats.C },
                uDiversity: { value: stats.D },
                uAgency: { value: stats.A }
            },
            // wireframe: true, // debug
            transparent: true
        });

        const sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);

        // --- Simulation Loop ---
        let internalState: SimulationState = {
            ...DEFAULT_INITIAL_STATE,
            C: agent.metrics.C,
            D: agent.metrics.D,
            A: agent.metrics.A,
            generation: 0
        };

        const params: SimulationParameters = { ...agent.parameters, dt: 0.1 }; // Fast updates
        const control = agent.environmentalControl;

        let animationId: number;
        const clock = new THREE.Clock();

        const animate = () => {
            animationId = requestAnimationFrame(animate);
            const time = clock.getElapsedTime();

            // Run Simulation Step
            if (Math.random() > 0.5) { // Throttle sim slightly
                internalState = eulerMaruyamaStep(internalState, params, control);

                // Update Uniforms
                material.uniforms.uComplexity.value = THREE.MathUtils.lerp(material.uniforms.uComplexity.value, internalState.C, 0.05);
                material.uniforms.uDiversity.value = THREE.MathUtils.lerp(material.uniforms.uDiversity.value, internalState.D, 0.05);
                material.uniforms.uAgency.value = THREE.MathUtils.lerp(material.uniforms.uAgency.value, internalState.A, 0.05);

                // Update React State for UI overlays (throttled)
                if (Math.floor(time * 10) % 5 === 0) {
                    setStats({ ...internalState });
                }
            }

            // Animate Mesh
            sphere.rotation.y += 0.002 * (1 + internalState.A);
            sphere.rotation.z += 0.001 * (1 + internalState.C);

            material.uniforms.uTime.value = time;

            renderer.render(scene, camera);
        };

        animate();

        // --- Cleanup ---
        return () => {
            cancelAnimationFrame(animationId);
            if (containerRef.current && renderer.domElement) {
                containerRef.current.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, []); // Empty deps, we init once and run internal loop

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 2000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backdropFilter: 'blur(5px)'
        }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '80%',
                    height: '80%',
                    backgroundColor: 'rgba(20, 20, 40, 0.9)',
                    borderRadius: '24px',
                    border: '1px solid var(--color-primary-dim)',
                    boxShadow: '0 0 50px rgba(0,0,0,0.5)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* 3D Container */}
                <div ref={containerRef} style={{ flex: 2, height: '100%' }} />

                {/* HUD Overlay */}
                <div style={{
                    flex: 1,
                    padding: '32px',
                    borderLeft: '1px solid rgba(255,255,255,0.1)',
                    background: 'linear-gradient(to right, rgba(0,0,0,0.5), transparent)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px'
                }}>
                    <div>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '2.5rem', fontFamily: 'Outfit, sans-serif' }}>
                            {agent.name}
                        </h2>
                        <div style={{ opacity: 0.7, fontFamily: 'monospace' }}>
                            ID: {agent.id.substring(0, 8)}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <MetricBar label="Agency (A)" value={stats.A} color="var(--color-agency)" />
                        <MetricBar label="Complexity (C)" value={stats.C} color="var(--color-complexity)" />
                        <MetricBar label="Diversity (D)" value={stats.D} color="var(--color-diversity)" />
                    </div>

                    <div style={{
                        marginTop: 'auto',
                        padding: '16px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        lineHeight: '1.5'
                    }}>
                        <strong>Simulation Status:</strong><br />
                        Running local instance of agent SDE.<br />
                        <span style={{ opacity: 0.6 }}>Observe the morphological changes as the agent interacts with its intrinsic parameters.</span>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            padding: '12px 24px',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        Close Preview
                    </button>
                </div>

                <div style={{
                    position: 'absolute',
                    top: '24px',
                    right: '24px',
                    cursor: 'pointer',
                    color: 'rgba(255,255,255,0.5)'
                }}
                    onClick={onClose}
                >
                    <X size={32} />
                </div>
            </div>
        </div>
    );
};

const MetricBar: React.FC<{ label: string, value: number, color: string }> = ({ label, value, color }) => (
    <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.9rem' }}>
            <span>{label}</span>
            <span style={{ fontFamily: 'monospace' }}>{value.toFixed(3)}</span>
        </div>
        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, height: '100%', background: color, transition: 'width 0.2s' }} />
        </div>
    </div>
);

export default AgentPreviewModal;
