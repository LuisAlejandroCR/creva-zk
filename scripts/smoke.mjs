#!/usr/bin/env node
// smoke.mjs
// Pre-flight traffic light for the recorded demo: checks Docker, the three
// compiled circuits, the artifacts served to the browser, the single runtime
// copy and the ports the demo binds. It reports; it never installs, never
// compiles and never calls a circuit.

import { execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// The whole point of a traffic light is that it answers before the operator
// gives up on it. Every external step below is bounded well under this.
const DOCKER_TIMEOUT_MS = 8_000;
const RUNTIME_TIMEOUT_MS = 15_000;

// The three circuits `npm run compact:build` writes, one directory each.
// A circuit without its prover key compiles the TypeScript and then dies
// inside the proof, which is the failure this check exists to move earlier.
const CIRCUITS = ['backing', 'backing-tier', 'identity-check'];

// Only the ports the recorded (`bridge`) route binds itself. 6300 is the
// lace route's proof server and must be BUSY there, not free, so it is not
// on this list.
const PORTS = [
  { port: 5173, who: 'vite (npm run dev --workspace web)' },
  { port: 8787, who: 'servidor de pruebas (npm run serve --workspace api)' },
];

/** One check's verdict. `fix` is the command that clears it. */
function ok(name, detail) {
  return { name, pass: true, detail, fix: null };
}
function fail(name, detail, fix) {
  return { name, pass: false, detail, fix };
}

function run(command, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: timeoutMs, cwd: ROOT }, (error, stdout, stderr) => {
      resolve({ error, stdout: String(stdout).trim(), stderr: String(stderr).trim() });
    });
  });
}

async function checkDocker() {
  const { error, stdout, stderr } = await run('docker', ['info', '--format', '{{.ServerVersion}}'], DOCKER_TIMEOUT_MS);
  if (error) {
    const why = error.code === 'ENOENT' ? 'no hay binario `docker` en el PATH' : (stderr.split('\n')[0] || 'el demonio no respondió');
    return fail('docker', why, 'arranca Docker Desktop o `sudo systemctl start docker`, y reintenta');
  }
  return ok('docker', `el demonio responde (server ${stdout || 'desconocido'})`);
}

/** Lists the files under one managed subdirectory, or [] when it is absent. */
function filesIn(path) {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function checkCircuits() {
  const managed = join(ROOT, 'contract', 'src', 'managed');
  if (!existsSync(managed)) {
    return fail('circuitos', 'no existe contract/src/managed/', 'npm run compact:build');
  }

  const missing = [];
  for (const circuit of CIRCUITS) {
    const keys = filesIn(join(managed, circuit, 'keys'));
    const zkir = filesIn(join(managed, circuit, 'zkir'));
    const provers = keys.filter((name) => name.endsWith('.prover'));
    const verifiers = keys.filter((name) => name.endsWith('.verifier'));
    const bzkir = zkir.filter((name) => name.endsWith('.bzkir'));
    if (provers.length === 0 || verifiers.length === 0 || bzkir.length === 0) {
      missing.push(`${circuit} (${provers.length} .prover, ${verifiers.length} .verifier, ${bzkir.length} .bzkir)`);
    }
  }

  if (missing.length > 0) {
    return fail('circuitos', `sin claves de prueba completas: ${missing.join('; ')}`, 'npm run compact:build');
  }
  return ok('circuitos', `los ${CIRCUITS.length} compilados con .prover, .verifier y .bzkir`);
}

function checkWebArtifacts() {
  const zkDir = join(ROOT, 'web', 'public', 'zk');
  const keys = filesIn(join(zkDir, 'keys'));
  const zkir = filesIn(join(zkDir, 'zkir'));
  const provers = keys.filter((name) => name.endsWith('.prover'));
  if (provers.length === 0 || zkir.length === 0) {
    return fail('artefactos web', 'web/public/zk/ vacío o sin claves', 'npm run zk:copy --workspace web');
  }
  let bytes = 0;
  for (const [dir, names] of [[join(zkDir, 'keys'), keys], [join(zkDir, 'zkir'), zkir]]) {
    for (const name of names) bytes += statSync(join(dir, name)).size;
  }
  return ok('artefactos web', `${keys.length + zkir.length} archivos, ${(bytes / 1_000_000).toFixed(1)} MB en web/public/zk/`);
}

// Reuses scripts/check-runtime.mjs as-is rather than restating its rule: it
// already knows what two copies of the WASM runtime cost, and its exit code
// is the answer this check needs.
async function checkRuntime() {
  const { error, stdout, stderr } = await run(process.execPath, [join(ROOT, 'scripts', 'check-runtime.mjs')], RUNTIME_TIMEOUT_MS);
  const output = (stderr || stdout).split('\n').filter(Boolean);
  if (error) {
    return fail('runtime', output[0] ?? 'check-runtime.mjs falló', 'npm dedupe');
  }
  return ok('runtime', stdout || 'una sola copia de onchain-runtime-v3');
}

/** Resolves true when nothing is already listening on the port. */
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '0.0.0.0');
  });
}

async function checkPorts() {
  const busy = [];
  for (const { port, who } of PORTS) {
    if (!(await isPortFree(port))) busy.push(`${port} — lo quiere ${who}`);
  }
  if (busy.length > 0) {
    return fail('puertos', `ocupados: ${busy.join('; ')}`, 'cierra el proceso (`lsof -ti :PUERTO | xargs kill`) o mueve el puerto');
  }
  return ok('puertos', `libres: ${PORTS.map((entry) => entry.port).join(', ')}`);
}

const results = [
  await checkDocker(),
  checkCircuits(),
  checkWebArtifacts(),
  await checkRuntime(),
  await checkPorts(),
];

const width = Math.max(...results.map((result) => result.name.length));
for (const result of results) {
  const mark = (result.pass ? 'OK' : 'FALLA').padEnd(5);
  console.log(`${mark} ${result.name.padEnd(width)}  ${result.detail}`);
  if (result.fix !== null) console.log(`${''.padEnd(6 + width)}  arreglo: ${result.fix}`);
}

const failed = results.filter((result) => !result.pass);
if (failed.length === 0) {
  console.log('\nsmoke: verde — la demo puede grabarse.');
  process.exit(0);
}

console.error(`\nsmoke: ${failed.length} de ${results.length} en rojo (${failed.map((r) => r.name).join(', ')}). NO grabes todavía.`);
process.exit(1);
