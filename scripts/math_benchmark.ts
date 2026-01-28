
import { MathScenario } from '../src/renderer/src/simulation/scenarios/math/MathScenario';
import { ControlSignal } from '../src/renderer/src/simulation/types';

async function runBenchmark() {
    console.log("Starting MathScenario Benchmark (4000 Generations)...");
    
    // Initialize
    const scenario = new MathScenario();
    scenario.initialize(Date.now());
    
    // Using a moderate difficulty to encourage growth
    // The user didn't specify U, but "Challenge" implies likely U > 0
    const control: ControlSignal = { U: 0.5 };
    const maxGen = 4000;
    const start = Date.now();
    
    for (let i = 1; i <= maxGen; i++) {
        scenario.step(control);
        
        if (i % 500 === 0) {
            const metrics = scenario.getMetrics();
            // @ts-ignore - accessing state directly for logging
            const state = scenario.getState();
            // @ts-ignore - metrics interface update might be needed if totalProvenTheorems isn't in TelemetryPoint
            const provenCount = state.metrics.totalProvenTheorems || 0;
            console.log(`Gen ${i}: A=${metrics.A.toFixed(3)}, C=${metrics.C.toFixed(3)}, D=${metrics.D.toFixed(3)}, Claims=${state.claims.length}, Proven=${provenCount}`);
        }
    }
    
    const end = Date.now();
    const duration = (end - start) / 1000;
    
    console.log(`\nBenchmark Completed in ${duration.toFixed(2)}s`);
    console.log(`Speed: ${(maxGen / duration).toFixed(2)} gen/s`);
    
    const finalMetrics = scenario.getMetrics();
    console.log("\nFinal Metrics:");
    console.log(JSON.stringify(finalMetrics, null, 2));
    
    // @ts-ignore
    const state = scenario.getState();
    const proven = state.claims.filter((c: any) => c.proven);
    console.log(`\nTotal Proven Theorems: ${proven.length}`);
    if (proven.length > 0) {
        console.log("Sample Proven Theorem:", proven[0].text);
        if (proven[0].proof) {
             console.log("Proof Steps:", proven[0].proof.steps.join(' -> '));
        }
    }
}

runBenchmark().catch(console.error);
