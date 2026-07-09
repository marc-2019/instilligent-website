#!/usr/bin/env node
/**
 * Vitest 4 / rolldown need Node ^20.19 || >=22.12.
 * System Node 18 fails with: node:util has no export 'styleText'.
 */
const major = Number(process.versions.node.split('.')[0]);
const minMajor = 20;
if (Number.isNaN(major) || major < minMajor) {
  console.error(
    `[instilligent-website] Node ${process.versions.node} is too old.\n` +
      `  Need Node >=20.19 (recommend 22). Example:\n` +
      `    nvm use   # reads .nvmrc\n` +
      `    npm test`
  );
  process.exit(1);
}
