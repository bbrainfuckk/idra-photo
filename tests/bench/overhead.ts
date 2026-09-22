/**
 * Orchestration overhead benchmark (SIMULATED host, fixture images).
 * Compares Idra's combined step against an explicitly synthetic "chatty" baseline that also
 * fetches the full job list after every image, over the same 100-job mock workload.
 * Measures tool calls and JSON bytes only. Token counts are unknown: bytes are not tokens.
 */
import fs from 'node:fs';
import path from 'node:path';
import { runSimulatedBatch, type SimResult } from '../../src/sim/fakeHost.js';
import { CLI, REPO_ROOT, refPng, tmpWorkspace } from '../helpers.js';

const COUNT = Number(process.env['IDRA_BENCH_COUNT'] ?? 100);

async function run(chatty: boolean): Promise<SimResult> {
  const ws = tmpWorkspace('idra-bench-');
  const ref = refPng(ws, 'look.png', 11);
  return runSimulatedBatch({ cliPath: CLI, workspace: ws, count: COUNT, referencePath: ref, chatty });
}

function summarize(label: string, r: SimResult) {
  const calls = Object.values(r.metrics.calls).reduce((a, b) => a + b, 0);
  const steps = r.metrics.stepResponseBytes;
  return {
    design: label,
    images: r.generated,
    final_status: r.final.status,
    tool_calls: calls,
    calls_per_image: +(calls / r.generated).toFixed(2),
    request_bytes: r.metrics.requestBytes,
    response_bytes: r.metrics.responseBytes,
    response_bytes_per_image: Math.round(r.metrics.responseBytes / r.generated),
    step_response_bytes_median: steps.slice().sort((a, b) => a - b)[Math.floor(steps.length / 2)],
    job_prompt_bytes_total: r.promptBytes,
    server_instructions_bytes_once: r.instructionsBytes,
  };
}

const compact = summarize('idra combined step', await run(false));
const chatty = summarize('synthetic chatty baseline (combined step + full job list after every image)', await run(true));
const out = {
  measured_at: new Date().toISOString(),
  node: process.versions.node,
  platform: `${process.platform}-${process.arch}`,
  workload: `${COUNT} simulated jobs, 1 style reference, variations mode, 64x80 fixture PNGs`,
  results: [compact, chatty],
  limits: [
    'Bytes of MCP tool JSON only. Token counts are unknown (no tokenizer or host usage data was available).',
    'Excludes host planning/reasoning, native image generation, image inputs, retries, and review.',
    'The chatty baseline is synthetic and defined by this script; it is not a measurement of another product.',
  ],
};
fs.mkdirSync(path.join(REPO_ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(REPO_ROOT, 'docs', 'overhead-results.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
