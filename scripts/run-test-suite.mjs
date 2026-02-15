#!/usr/bin/env node
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';

const suites = {
  unit: [
    'src/main/aiService.test.ts',
    'src/main/storage/agentLibraryStorage.test.ts',
    'src/renderer/src/simulation/metrics/AgencyMetrics.test.ts',
    'src/renderer/src/simulation/snapshot.test.ts',
    'src/renderer/src/simulation/scenarios/math/MathVerificationTiming.test.ts'
  ],
  determinism: ['src/renderer/src/simulation/determinism.test.ts']
};

const requestedSuite = process.argv[2] ?? 'unit';
if (!suites[requestedSuite]) {
  console.error(`Unknown test suite '${requestedSuite}'. Supported suites: ${Object.keys(suites).join(', ')}`);
  process.exit(1);
}

const spawnAndWait = (command, args, options = {}) => new Promise((resolveRun, rejectRun) => {
  const child = spawn(command, args, options);
  child.on('error', rejectRun);
  child.on('close', code => resolveRun(code ?? 1));
});

const bundleTest = async (file, outFile) => {
  const code = await spawnAndWait(
    'npx',
    [
      'esbuild',
      file,
      '--bundle',
      '--platform=node',
      '--format=cjs',
      '--target=node22',
      `--outfile=${outFile}`,
      '--define:import.meta.env={}'
    ],
    { stdio: 'inherit' }
  );

  if (code !== 0) {
    throw new Error(`Failed to bundle ${file}`);
  }
};

const run = async () => {
  const files = suites[requestedSuite];
  const results = [];
  let failed = 0;
  const tmpDir = resolve('.tmp-tests', requestedSuite);
  const coverageDir = resolve('coverage', requestedSuite);

  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(coverageDir, { recursive: true });

  for (const file of files) {
    const start = performance.now();
    const outFile = resolve(tmpDir, `${basename(file, '.ts')}.cjs`);
    try {
      await bundleTest(file, outFile);
      const code = await spawnAndWait(process.execPath, [outFile], {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_V8_COVERAGE: coverageDir
        }
      });
      const durationMs = Math.round(performance.now() - start);
      results.push({ file, code, durationMs });
      if (code !== 0) failed += 1;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      results.push({ file, code: 1, durationMs, error: String(error) });
      failed += 1;
    }
  }

  const summary = {
    suite: requestedSuite,
    total: results.length,
    failed,
    passed: results.length - failed,
    totalDurationMs: results.reduce((sum, result) => sum + result.durationMs, 0),
    results,
    generatedAt: new Date().toISOString()
  };

  const outputPath = resolve('artifacts', 'metrics', `${requestedSuite}-test-metrics.json`);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(summary, null, 2));

  if (failed > 0) {
    process.exit(1);
  }
};

run().catch(error => {
  console.error(error);
  process.exit(1);
});
