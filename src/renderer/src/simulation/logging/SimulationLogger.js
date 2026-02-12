class SimulationLoggerService {
    buffer = [];
    maxBufferSize = 50000; // Cap to prevent memory leaks
    logAgent(point) {
        this.buffer.push(point);
        if (this.buffer.length > this.maxBufferSize) {
            // Trim oldest, keep newest
            this.buffer = this.buffer.slice(this.buffer.length - this.maxBufferSize);
        }
    }
    getPoints() {
        return this.buffer;
    }
    clear() {
        this.buffer = [];
    }
}
export const SimulationLogger = new SimulationLoggerService();
