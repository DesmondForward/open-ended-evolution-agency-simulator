
import { BioScenario } from '../src/renderer/src/simulation/scenarios/bio/BioScenario'; // Adjust path if needed
import { BioAgent } from '../src/renderer/src/simulation/scenarios/bio/BioAgent';

// Mock types if needed or rely on ts-node/vite-node to resolve

async function runVerification() {
    console.log("Starting ATI Verification...");

    const scenario = new BioScenario();
    scenario.initialize(12345, {
        initialPopulation: 20,
        maxPopulation: 50,
        mutationRate: 0.1,
        energyPerTick: 2000
    });

    console.log("Initialized BioScenario with 20 agents.");

    // Run for 100 generations
    for (let i = 0; i < 100; i++) {
        scenario.step({ U: 0.5 }); // Moderate toxicity

        if (i % 10 === 0) {
            const metrics = scenario.getMetrics();
            console.log(`Gen ${i}: Agency(A) = ${metrics.A.toFixed(4)}, Pop = ${scenario.getState().agents.length}`);

            // Check top agent
            const agents = scenario.getState().agents;
            if (agents.length > 0) {
                // Find max ATI
                let maxAti = -1;
                agents.forEach(a => {
                    if (a.atiScore && a.atiScore > maxAti) maxAti = a.atiScore;
                });
                console.log(`   Top Agent ATI: ${maxAti.toFixed(4)}`);
            }
        }
    }

    console.log("Verification Complete.");
}

runVerification().catch(console.error);
