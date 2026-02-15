/**
 * Deterministic Pseudo-Random Number Generator
 * Implements Mulberry32 algorithm
 */
export class PRNG {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    /**
     * Set a new seed for the generator
     */
    public setSeed(seed: number): void {
        this.seed = seed;
    }

    /**
     * Get current internal state for deterministic serialization/replay.
     */
    public getState(): number {
        return this.seed;
    }

    /**
     * Get the next random number between 0 (inclusive) and 1 (exclusive)
     */
    public next(): number {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /**
     * Get a random integer between min (inclusive) and max (exclusive)
     */
    public nextInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min)) + min;
    }

    /**
     * Get a random boolean
     */
    public nextBoolean(): boolean {
        return this.next() >= 0.5;
    }

    /**
     * Get a random element from an array
     */
    public pick<T>(array: T[]): T {
        return array[this.nextInt(0, array.length)];
    }
}
