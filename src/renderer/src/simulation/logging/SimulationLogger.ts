
export interface LatticePoint {
    generation: number;
    agentId: string;
    lineageId: string;
    energy: number;   // X-axis: Cost/Energy
    novelty: number;  // Y-axis: Novelty/Complexity/Variance
    fitness: number;  // Z-axis: Score/Fitness
}

class SimulationLoggerService {
    private buffer: LatticePoint[] = [];
    private maxBufferSize: number = 50000; // Cap to prevent memory leaks

    public logAgent(point: LatticePoint) {
        this.buffer.push(point);
        if (this.buffer.length > this.maxBufferSize) {
            // Trim oldest, keep newest
            this.buffer = this.buffer.slice(this.buffer.length - this.maxBufferSize);
        }
    }

    public getPoints(): LatticePoint[] {
        return this.buffer;
    }

    public clear() {
        this.buffer = [];
    }
}

export const SimulationLogger = new SimulationLoggerService();
