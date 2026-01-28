
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
// @ts-ignore
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { SimulationLogger, LatticePoint } from '../../simulation/logging/SimulationLogger';

export const ConstraintLattice: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        // --- Setup ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111111);

        // Fog to give depth
        scene.fog = new THREE.FogExp2(0x111111, 0.05);

        const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
        camera.position.set(20, 20, 20);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        mountRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        // --- Helpers ---
        const axesHelper = new THREE.AxesHelper(15);
        scene.add(axesHelper);

        const gridHelper = new THREE.GridHelper(30, 30, 0x444444, 0x222222);
        scene.add(gridHelper);

        // Labels (using simple text sprites or just implied)
        // Red: X (Energy Cost)
        // Green: Y (Novelty)
        // Blue: Z (Fitness)

        // --- Data Management ---
        const lineageMaterials: Record<string, THREE.LineBasicMaterial> = {};
        const lineageGeometries: Record<string, THREE.BufferGeometry> = {};
        const lineageLines: Record<string, THREE.Line> = {};
        const lineagePoints: Record<string, THREE.Vector3[]> = {};

        let lastPointCount = 0;

        const getMaterial = (id: string) => {
            if (!lineageMaterials[id]) {
                const color = new THREE.Color().setHSL(Math.random(), 0.8, 0.5);
                lineageMaterials[id] = new THREE.LineBasicMaterial({ color, opacity: 0.8, transparent: true });
            }
            return lineageMaterials[id];
        };

        const updateTrails = () => {
            const points = SimulationLogger.getPoints();
            if (points.length === lastPointCount) return; // No new data
            lastPointCount = points.length;

            // Group by lineage
            // Optimization: Only process new points if we tracked them, but for now re-process ensures coherence
            // Or better: clear and rebuild geometries if performance allows (buffer size < 50k should be ok for lines)

            // To be efficient:
            // 1. Iterate over buffer
            // 2. Append to local lineagePoints arrays
            // 3. Update geometries

            // Reset local cache? Or delta?
            // Let's do a full rebuild for simplicity/correctness first, optimize later

            const currentLineages: Record<string, THREE.Vector3[]> = {};

            // Scaling Factors
            // Energy: 0-200 -> 0-20
            // Novelty: 0-0.5 -> 0-10
            // Fitness: 0-20 -> 0-15
            const scaleX = (e: number) => Math.min(20, e / 10);
            const scaleY = (n: number) => Math.min(20, n * 40);
            const scaleZ = (f: number) => Math.min(20, f);

            points.forEach(p => {
                if (!currentLineages[p.lineageId]) {
                    currentLineages[p.lineageId] = [];
                }
                currentLineages[p.lineageId].push(new THREE.Vector3(
                    scaleX(p.energy),
                    scaleZ(p.fitness), // Y is Up in Three.js usually, but let's map Z to Y for visualization natural feel? 
                    // Usually Y is up. So let's map fitness to Y (height).
                    // Lattice: X=Energy, Y=Novelty, Z=Fitness?
                    // Recommendation says: X=Energy, Y=Novelty, Z=Survival.
                    // Let's Map: X=Energy, Y=Fitness (Up), Z=Novelty (Depth)
                    // Wait, text says Z=Survival.
                    scaleY(p.novelty)
                ));
            });

            // Update Scene
            Object.keys(currentLineages).forEach(lid => {
                const pts = currentLineages[lid];
                if (pts.length < 2) return; // Need 2 points for a line

                if (!lineageLines[lid]) {
                    const geom = new THREE.BufferGeometry().setFromPoints(pts);
                    const line = new THREE.Line(geom, getMaterial(lid));
                    scene.add(line);
                    lineageLines[lid] = line;
                    lineageGeometries[lid] = geom;
                } else {
                    lineageGeometries[lid].setFromPoints(pts);
                    // lineageGeometries[lid].verticesNeedUpdate = true; // Not needed for BufferGeometry
                }
            });
        };


        // --- Loop ---
        let animationId: number;
        const animate = () => {
            animationId = requestAnimationFrame(animate);
            controls.update();
            updateTrails();
            renderer.render(scene, camera);
        };
        animate();

        // --- Cleanup ---
        const handleResize = () => {
            if (mountRef.current) {
                camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationId);
            mountRef.current?.removeChild(renderer.domElement);
            renderer.dispose();
            // Dispose geometries/materials to avoid leaks
            Object.values(lineageGeometries).forEach(g => g.dispose());
            Object.values(lineageMaterials).forEach(m => m.dispose());
        };
    }, []);

    return (
        <div className="w-full h-full relative" ref={mountRef}>
            <div className="absolute top-4 left-4 bg-black/50 p-2 text-xs text-white pointer-events-none rounded">
                <div className="font-bold mb-1">Constraint Lattice</div>
                <div style={{ color: '#ff4444' }}>X: Energy Cost</div>
                <div style={{ color: '#44ff44' }}>Y: Fitness (Score)</div>
                <div style={{ color: '#4444ff' }}>Z: Novelty (Variance)</div>
            </div>
        </div>
    );
};
