
import * as metrics from './AgencyMetrics';

// Mock types
interface MockTask { requirements: Record<string, number> }

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

async function runTests() {
    console.log("Starting AgencyMetrics Tests...");

    // 1. Entropy
    const tasks: any[] = [
        { requirements: { A: 10, B: 10 } },
        { requirements: { A: 10, B: 10 } }
    ];
    // Values: 10, 10, 10, 10. Total 40. p = 0.25 each.
    // H = -4 * (0.25 * log2(0.25)) = -4 * (0.25 * -2) = 2.0
    const H = metrics.computeEntropy(tasks);
    assert(Math.abs(H - 2.0) < 0.001, `Entropy should be 2.0, got ${H}`);

    // 2. behavioral Variance
    const p1 = [1.0, 0.5];
    const p2 = [0.9, 0.5]; // Diff is 0.1 on first dim
    const bv = metrics.computeBehavioralVariance(p1, p2);
    // Sqrt(0.1^2 + 0^2) = 0.1
    assert(Math.abs(bv - 0.1) < 0.001, `BV should be 0.1, got ${bv}`);

    // 3. Feedback Gain
    // AFG = BV / (|DeltaScore| + eps)
    // BV=0.1, DeltaScore=10
    const afg = metrics.computeFeedbackGain(0.1, 10);
    assert(Math.abs(afg - (0.1 / 10)) < 0.001, `AFG should be approx 0.01, got ${afg}`);

    // 4. Emergent Intention
    // Sigmoid(alpha*EE + beta*AFG - delta*BV + gamma*TP)
    // Let's maximize everything: EE=10, AFG=10, BV=0, TP=1 => High EI
    const eiHigh = metrics.computeEmergentIntention(10, 10, 0, 1.0);
    assert(eiHigh > 0.9, `EI should be high (>0.9), got ${eiHigh}`);

    // Let's fail everything: EE=-10, AFG=0, BV=10, TP=0
    const eiLow = metrics.computeEmergentIntention(-10, 0, 10, 0);
    assert(eiLow < 0.1, `EI should be low (<0.1), got ${eiLow}`);

    console.log("All tests passed!");
}

runTests();
