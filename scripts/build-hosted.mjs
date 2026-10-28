import { build } from 'esbuild';
await build({
  entryPoints: ['server/hosted.ts'],
  outfile: '.generated/arrival.mjs',
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
