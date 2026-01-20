import { ScenarioEvent, TelemetryPoint, ScenarioMetadata } from '../types';

export interface RunManifest {
    appVersion: string;
    scenarioId: string;
    scenarioConfig: any;
    seed: number;
    startTimestamp: string;
    endTimestamp?: string;
    runDurationSeconds?: number;

    aiModels?: {
        researcher?: string;
        xenobiologist?: string;
    };

    hardwareMode: 'cpu' | 'webgpu';

    summaryMetrics?: {
        peakAgency: number;
        finalDiversity: number;
        totalGenerations: number;
        alertCount: number;
    };
}

export class EventLogService {
    private events: ScenarioEvent[] = [];
    private telemetryBuffer: TelemetryPoint[] = [];
    private manifest: RunManifest;

    // Limits
    private maxEvents: number = 2000;
    private maxTelemetry: number = 10000;

    constructor(scenarioMetadata: ScenarioMetadata, seed: number, config: any) {
        this.manifest = {
            appVersion: '2.0.0',
            scenarioId: scenarioMetadata.id,
            scenarioConfig: config,
            seed: seed,
            startTimestamp: new Date().toISOString(),
            hardwareMode: 'cpu' // Default, update if needed
        };
    }

    public logEvent(event: ScenarioEvent) {
        this.events.push(event);
        if (this.events.length > this.maxEvents) {
            // Prune old events or archive? For now just prune for memory safety
            this.events.shift();
        }

        // Update summary metrics on fly if needed
    }

    public logTelemetry(point: TelemetryPoint) {
        this.telemetryBuffer.push(point);
        if (this.telemetryBuffer.length > this.maxTelemetry) {
            this.telemetryBuffer.shift();
        }
    }

    public getEvents(): ScenarioEvent[] {
        return this.events;
    }

    public getTelemetry(): TelemetryPoint[] {
        return this.telemetryBuffer;
    }

    public endRun() {
        this.manifest.endTimestamp = new Date().toISOString();
        // Calculate summary metrics
    }

    public getManifest(): RunManifest {
        return this.manifest;
    }

    public exportBundle(): string {
        return JSON.stringify({
            manifest: this.manifest,
            events: this.events,
            telemetry: this.telemetryBuffer
        }, null, 2);
    }
}
