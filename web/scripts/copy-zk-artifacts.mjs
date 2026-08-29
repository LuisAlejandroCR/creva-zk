#!/usr/bin/env node
// copy-zk-artifacts.mjs
// CLI wrapper around copyZkArtifacts.mjs, run before the web build. Missing
// artifacts are fatal by default — a build that cannot prove must not ship
// silently — and a warning under --allow-missing, which `dev` uses.

import { fileURLToPath } from 'node:url';
import { copyPlan, describeFailure, planCopy } from './copyZkArtifacts.mjs';

const MANAGED_DIR = fileURLToPath(new URL('../../contract/src/managed', import.meta.url));
const PUBLIC_ZK_DIR = fileURLToPath(new URL('../public/zk', import.meta.url));

const allowMissing = process.argv.includes('--allow-missing');
const plan = planCopy(MANAGED_DIR);

if (plan.status !== 'ok') {
  const message = describeFailure(plan);
  if (allowMissing) {
    console.warn(`[zk] warning: ${message}`);
    process.exit(0);
  }
  console.error(`[zk] ${message}`);
  process.exit(1);
}

const result = copyPlan(plan, PUBLIC_ZK_DIR);
if (result.status !== 'ok') {
  console.error(`[zk] ${describeFailure({ ...plan, status: result.status })}\n${result.reason ?? ''}`);
  process.exit(allowMissing ? 0 : 1);
}

const megabytes = (result.bytes / 1_000_000).toFixed(1);
console.log(`[zk] copied ${result.copied} artifacts (${megabytes} MB) into web/public/zk/`);
