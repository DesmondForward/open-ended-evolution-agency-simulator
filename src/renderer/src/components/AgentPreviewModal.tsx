
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SavedAgent, SimulationState, SimulationParameters, DEFAULT_INITIAL_STATE } from '../simulation/types';
import { eulerMaruyamaStep } from '../simulation/sdeEngine';
import { X, Play } from 'lucide-react';

interface AgentPreviewModalProps {
    agent: SavedAgent;
    onClose: () => void;
}

const AgentPreviewModal: React.FC<AgentPreviewModalProps> = ({ agent, onClose }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [stats, setStats] = useState<SimulationState>({ ...DEFAULT_INITIAL_STATE, A: agent.metrics.A, C: agent.metrics.C, D: agent.metrics.D });

    // Extract DNA for shape generation
    const { k_CD, k_AC, k_DU, k_U, sigma_A } = agent.parameters;

    // Map k values to shape parameters
    const m_dna = 2 + (k_CD * 25) % 20;
    const n1_dna = 0.4 + (k_AC * 6);
    const n2_dna = 0.4 + (k_DU * 6);
    const n3_dna = 0.4 + (k_U * 10);

    const baseHueStrength = (sigma_A * 321.45) % 1;

    // --- CINEMATIC SHADER ---
    const vertexShader = `
        uniform float uTime;
        uniform float uComplexity;
        uniform float uAgency;
        
        uniform float uM;
        uniform float uN1;
        uniform float uN2;
        uniform float uN3;

        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying float vDisplacement;
        varying vec3 vWorldPosition;

        // Simplex Noise
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

        float superformula(float phi, float m, float n1, float n2, float n3) {
            float a = 1.0;
            float b = 1.0;
            float t1 = abs((1.0/a) * cos(m * phi / 4.0));
            t1 = pow(t1, n2);
            float t2 = abs((1.0/b) * sin(m * phi / 4.0));
            t2 = pow(t2, n3);
            float r = pow(t1 + t2, -1.0 / n1);
            return r;
        }

        void main() {
            vUv = uv;
            
            // Map sphere UV to spherical coordinates
            float phi = uv.y * 3.14159; 
            float theta = uv.x * 6.28318;

            // Base Super-shape
            float r1 = superformula(theta, uM, uN1, uN2, uN3);
            float r2 = superformula(phi, uM, uN1, uN2, uN3);
            
            // Dynamic Dynamics
            float pulse = 1.0 + sin(uTime * (0.5 + uAgency * 4.0)) * (0.02 + 0.05 * uAgency);
            float noiseScale = 0.5 + uComplexity * 2.0;
            float noiseVal = snoise(vec3(position.x * noiseScale + uTime * 0.2, position.y * noiseScale, position.z * noiseScale));
            
            // Apply Displacement
            float r = r1 * r2 * pulse;
            r += noiseVal * (0.1 * uComplexity); // Add organic noise

            vec3 newPos = position * r;
            
            // Recalculate basic normal (approximate)
            vNormal = normalize(normal + noiseVal * 0.2); 
            vWorldPosition = (modelMatrix * vec4(newPos, 1.0)).xyz;
            vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
            vViewPosition = -mvPosition.xyz;
            vDisplacement = r;

            gl_Position = projectionMatrix * mvPosition;
        }
    `;

    const fragmentShader = `
        uniform float uDiversity;
        uniform float uAgency;
        uniform float uTime;
        uniform float uBaseHue;
        
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying float vDisplacement;
        varying vec3 vWorldPosition;

        // Cosine based palette, 4 vec3 params
        vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
            return a + b*cos( 6.28318*(c*t+d) );
        }

        void main() {
            vec3 viewDir = normalize(vViewPosition);
            vec3 normal = normalize(vNormal);

            // --- CINEMATIC BASE COLOR ---
            // Create a rich, iridescent palette based on Diversity and DNA
            vec3 a = vec3(0.5, 0.5, 0.5);
            vec3 b = vec3(0.5, 0.5, 0.5);
            vec3 c = vec3(1.0, 1.0, 1.0);
            vec3 d = vec3(0.00, 0.33, 0.67); // Phase shift
            
            // Shift phase based on diversity and baseHue
            d += vec3(uBaseHue, uBaseHue + 0.1, uBaseHue + 0.2);
            d += uDiversity * 0.5;

            // Color variation across the surface based on displacement and view angle
            float scalar = vDisplacement * 0.5 + dot(normal, viewDir) * 0.5;
            vec3 color = palette(scalar + uTime * 0.1, a, b, c, d);

            // --- FRESNEL & RIM ---
            float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.5);
            
            // Iridescent Rim
            vec3 rimColor = palette(scalar + 0.5, a, b, c, d + vec3(0.2)); 
            
            // --- GLOW & CORE ---
            // High Agency = Hotter core, brighter rim
            float glowIntensity = uAgency * 1.5;
            vec3 glowColor = vec3(1.0, 0.9, 0.8) * glowIntensity;
            
            // --- COMPOSITE ---
            vec3 finalColor = color * 0.5; // Darker base
            finalColor += rimColor * fresnel * 2.0; // Bright rim
            finalColor += glowColor * fresnel * (0.5 + uAgency); // Active glow on edges
            finalColor += glowColor * 0.1; // Ambient glow

            // Tone Mapping (Reinhard-ish) to prevent blowout but keep energy
            finalColor = finalColor / (finalColor + vec3(1.0));
            finalColor = pow(finalColor, vec3(0.4545)); // Gamma correction

            gl_FragColor = vec4(finalColor, 0.95);
        }
    `;

    // --- Particle System Shader ---
    const particleVertexShader = `
        uniform float uTime;
        attribute float size;
        attribute float speed;
        varying float vAlpha;
        void main() {
            vec3 pos = position;
            // Float upwards
            pos.y += uTime * speed; 
            // Wrap around
            if (pos.y > 10.0) pos.y -= 20.0;
            
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = size * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
            
            // Fade particles at top/bottom
            vAlpha = 1.0 - smoothstep(8.0, 10.0, abs(pos.y));
        }
    `;
    const particleFragmentShader = `
        varying float vAlpha;
        void main() {
            // Soft circular particle
            float r = distance(gl_PointCoord, vec2(0.5));
            if (r > 0.5) discard;
            float glow = 1.0 - (r * 2.0);
            glow = pow(glow, 1.5);
            gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * glow * 0.5);
        }
    `;

    useEffect(() => {
        if (!containerRef.current) return;

        // --- Init Three.js ---
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.z = 6;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x000000, 0); // Transparent background for DOM blur
        containerRef.current.appendChild(renderer.domElement);

        // --- Geometric Entity ---
        const geometry = new THREE.SphereGeometry(1.5, 192, 192); // Higher poly count
        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uComplexity: { value: stats.C },
                uDiversity: { value: stats.D },
                uAgency: { value: stats.A },
                uM: { value: m_dna },
                uN1: { value: n1_dna },
                uN2: { value: n2_dna },
                uN3: { value: n3_dna },
                uBaseHue: { value: baseHueStrength }
            },
            transparent: true,
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // --- Particle Background ---
        const particleCount = 200;
        const particles = new THREE.BufferGeometry();
        const pPositions = new Float32Array(particleCount * 3);
        const pSizes = new Float32Array(particleCount);
        const pSpeeds = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            pPositions[i * 3] = (Math.random() - 0.5) * 20;
            pPositions[i * 3 + 1] = (Math.random() - 0.5) * 20;
            pPositions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 5; // Background layer
            pSizes[i] = Math.random() * 2;
            pSpeeds[i] = 0.2 + Math.random() * 0.5;
        }

        particles.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
        particles.setAttribute('size', new THREE.BufferAttribute(pSizes, 1));
        particles.setAttribute('speed', new THREE.BufferAttribute(pSpeeds, 1));

        const particleMaterial = new THREE.ShaderMaterial({
            vertexShader: particleVertexShader,
            fragmentShader: particleFragmentShader,
            uniforms: { uTime: { value: 0 } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const particleSystem = new THREE.Points(particles, particleMaterial);
        scene.add(particleSystem);

        // --- Simulation Loop ---
        let internalState: SimulationState = {
            ...DEFAULT_INITIAL_STATE,
            C: agent.metrics.C,
            D: agent.metrics.D,
            A: agent.metrics.A,
            generation: 0
        };

        const params: SimulationParameters = { ...agent.parameters, dt: 0.1 };
        const control = agent.environmentalControl;

        let animationId: number;
        const clock = new THREE.Clock();

        const animate = () => {
            animationId = requestAnimationFrame(animate);
            const time = clock.getElapsedTime();

            if (activeRef.current) {
                internalState = eulerMaruyamaStep(internalState, params, control);

                // Smooth dampening
                material.uniforms.uComplexity.value = THREE.MathUtils.lerp(material.uniforms.uComplexity.value, internalState.C, 0.08);
                material.uniforms.uDiversity.value = THREE.MathUtils.lerp(material.uniforms.uDiversity.value, internalState.D, 0.08);
                material.uniforms.uAgency.value = THREE.MathUtils.lerp(material.uniforms.uAgency.value, internalState.A, 0.08);

                // Throttle react update
                if (Math.floor(time * 20) % 5 === 0) setStats({ ...internalState });
            }

            // High-fidelity slow rotation
            mesh.rotation.y += 0.003 * (0.8 + internalState.A);
            mesh.rotation.x = Math.sin(time * 0.2) * 0.1;

            material.uniforms.uTime.value = time;
            particleMaterial.uniforms.uTime.value = time;

            renderer.render(scene, camera);
        };

        animate();

        const handleResize = () => {
            if (!containerRef.current) return;
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', handleResize);
            if (containerRef.current && renderer.domElement) {
                containerRef.current.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
            particles.dispose();
            particleMaterial.dispose();
            renderer.dispose();
        };
    }, []);

    const activeRef = useRef(true);
    const [isPlaying, setIsPlaying] = useState(true);
    const togglePlay = () => {
        activeRef.current = !activeRef.current;
        setIsPlaying(activeRef.current);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 2000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backdropFilter: 'blur(15px)'
        }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '95%',
                    height: '90%',
                    maxWidth: '1400px',
                    backgroundColor: 'rgba(8, 8, 16, 0.8)',
                    borderRadius: '24px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 0 120px rgba(0,0,0,0.9)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'row'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* 3D Container - dominate the view */}
                <div ref={containerRef} style={{ flex: 1, height: '100%', position: 'relative' }}>

                    {/* Cinematic Overlay Title (Floating) */}
                    <div style={{
                        position: 'absolute',
                        top: '40px',
                        left: '40px',
                        pointerEvents: 'none'
                    }}>
                        <h1 style={{
                            margin: 0,
                            fontSize: '4rem',
                            fontWeight: 200,
                            fontFamily: 'Outfit, sans-serif',
                            color: 'rgba(255,255,255,0.9)',
                            textShadow: '0 0 30px rgba(255,255,255,0.2)'
                        }}>
                            {agent.name}
                        </h1>
                        <div style={{
                            opacity: 0.6,
                            fontFamily: 'monospace',
                            fontSize: '1rem',
                            letterSpacing: '2px',
                            marginTop: '8px'
                        }}>
                            {agent.id}
                        </div>
                    </div>
                </div>

                {/* HUD Overlay - Clean Glass Panel */}
                <div style={{
                    width: '320px',
                    padding: '32px',
                    borderLeft: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(10, 10, 15, 0.6)',
                    backdropFilter: 'blur(20px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '32px',
                    zIndex: 10
                }}>
                    {/* DNA Visualization */}
                    <div>
                        <h4 style={{ margin: '0 0 16px 0', opacity: 0.5, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
                            Morphological DNA
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#aaa' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Harmonic M:</span> <span style={{ color: '#fff' }}>{m_dna.toFixed(1)}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tension N1:</span> <span style={{ color: '#fff' }}>{n1_dna.toFixed(1)}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Curve N2:</span> <span style={{ color: '#fff' }}>{n2_dna.toFixed(1)}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Scale N3:</span> <span style={{ color: '#fff' }}>{n3_dna.toFixed(1)}</span></div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <h4 style={{ margin: '0', opacity: 0.5, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
                            Real-time Metrics
                        </h4>
                        <MetricBar label="Agency" value={stats.A} color="var(--color-agency)" />
                        <MetricBar label="Complexity" value={stats.C} color="var(--color-complexity)" />
                        <MetricBar label="Diversity" value={stats.D} color="var(--color-diversity)" />
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <button
                            onClick={togglePlay}
                            style={{
                                padding: '16px', borderRadius: '12px', border: 'none',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'white',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                fontSize: '0.9rem',
                                transition: 'background 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        >
                            <Play size={18} fill={isPlaying ? "currentColor" : "none"} />
                            {isPlaying ? "Pause Simulation" : "Resume"}
                        </button>

                        <button
                            onClick={onClose}
                            style={{
                                padding: '16px',
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.6)',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
                                e.currentTarget.style.color = 'white';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                            }}
                        >
                            Return to Library
                        </button>
                    </div>
                </div>

                <div style={{
                    position: 'absolute',
                    top: '30px',
                    right: '30px',
                    cursor: 'pointer',
                    color: 'rgba(255,255,255,0.3)',
                    zIndex: 20,
                    transition: 'color 0.2s'
                }}
                    onClick={onClose}
                    onMouseOver={(e) => e.currentTarget.style.color = 'white'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                >
                    <X size={32} />
                </div>
            </div>
        </div>
    );
};

const MetricBar: React.FC<{ label: string, value: number, color: string }> = ({ label, value, color }) => (
    <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '1rem', fontWeight: 300, color: '#eee', letterSpacing: '1px' }}>
            <span>{label}</span>
            <span style={{ fontFamily: 'monospace', opacity: 0.7 }}>{value.toFixed(3)}</span>
        </div>
        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
                width: `${Math.min(100, Math.max(0, value * 100))}%`,
                height: '100%',
                background: color,
                transition: 'width 0.2s',
                boxShadow: `0 0 15px ${color}`
            }} />
        </div>
    </div>
);

export default AgentPreviewModal;
