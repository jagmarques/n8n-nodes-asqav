// Bundles @asqav/sdk into dist because n8n community nodes must ship zero runtime dependencies
import { build } from 'esbuild';

const targets = [
	'dist/nodes/Asqav/Asqav.node.js',
	'dist/credentials/AsqavApi.credentials.js',
];

for (const entry of targets) {
	await build({
		entryPoints: [entry],
		outfile: entry,
		allowOverwrite: true,
		bundle: true,
		platform: 'node',
		target: 'node18',
		format: 'cjs',
		external: ['n8n-workflow'],
		sourcemap: false,
	});
}
console.log('bundled @asqav/sdk into dist');
