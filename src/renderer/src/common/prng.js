/**
 * Deterministic Pseudo-Random Number Generator
 * Implements Mulberry32 algorithm
 */
export class PRNG {
    seed;
    constructor(seed) {
        this.seed = seed;
    }
    /**
     * Set a new seed for the generator
     */
    setSeed(seed) {
        this.seed = seed;
    }
    /**
     * Get the next random number between 0 (inclusive) and 1 (exclusive)
     */
    next() {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    /**
     * Get a random integer between min (inclusive) and max (exclusive)
     */
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min)) + min;
    }
    /**
     * Get a random boolean
     */
    nextBoolean() {
        return this.next() >= 0.5;
    }
    /**
     * Get a random element from an array
     */
    pick(array) {
        return array[this.nextInt(0, array.length)];
    }
}
