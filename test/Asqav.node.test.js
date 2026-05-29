'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');
const path = require('node:path');

const PKG_ROOT = path.resolve(__dirname, '..');

// --- Mock @asqav/sdk before the node is required ---
const initCalls = [];
const signCalls = [];

function installSdkMock() {
	const sdkPath = require.resolve('@asqav/sdk', { paths: [PKG_ROOT] });
	const fakeExports = {
		init(opts) {
			initCalls.push(opts);
		},
		Agent: {
			async create(opts) {
				return {
					name: opts.name,
					async sign(signOptions) {
						signCalls.push(signOptions);
						// Deterministic mocked receipt keyed off the action type.
						return {
							signature: 'base64-sig',
							signatureId: `sig_${signCalls.length}`,
							actionId: `act_${signCalls.length}`,
							timestamp: '2026-05-29T00:00:00Z',
							verificationUrl: `https://api.asqav.com/api/v1/verify/sig_${signCalls.length}`,
							chainHash: 'deadbeef',
						};
					},
				};
			},
		},
	};
	const cached = new Module(sdkPath, module);
	cached.filename = sdkPath;
	cached.loaded = true;
	cached.exports = fakeExports;
	require.cache[sdkPath] = cached;
}

installSdkMock();

// Require the compiled node AFTER the mock is in the cache.
const { Asqav } = require(path.join(PKG_ROOT, 'dist/nodes/Asqav/Asqav.node.js'));

// --- Minimal IExecuteFunctions harness ---
function makeContext({ items, params, credentials, continueOnFail }) {
	return {
		getInputData() {
			return items;
		},
		async getCredentials(name) {
			assert.strictEqual(name, 'asqavApi');
			return credentials;
		},
		getNodeParameter(name, itemIndex, fallback) {
			const perItem = params[itemIndex] || {};
			if (name in perItem) return perItem[name];
			return fallback;
		},
		continueOnFail() {
			return continueOnFail;
		},
		getNode() {
			return { name: 'Asqav: Sign Action' };
		},
	};
}

test('signs two input items and attaches the mocked receipt to each', async () => {
	initCalls.length = 0;
	signCalls.length = 0;

	const items = [{ json: { a: 1 } }, { json: { b: 2 } }];
	const ctx = makeContext({
		items,
		credentials: { apiKey: 'sk_test_123' },
		continueOnFail: false,
		params: [
			{ actionType: 'api:call', context: { model: 'gpt-4' }, options: { agentName: 'n8n' } },
			{ actionType: 'tool:invoke', context: {}, options: {} },
		],
	});

	const node = new Asqav();
	const result = await node.execute.call(ctx);

	// One output branch.
	assert.strictEqual(result.length, 1);
	const out = result[0];
	assert.strictEqual(out.length, 2);

	// init() called once per execute with the credential key.
	assert.strictEqual(initCalls.length, 1);
	assert.deepStrictEqual(initCalls[0], { apiKey: 'sk_test_123' });

	// Each output item carries the mocked signatureId and preserves original json.
	assert.strictEqual(out[0].json.a, 1);
	assert.strictEqual(out[0].json.asqavReceipt.signatureId, 'sig_1');
	assert.strictEqual(out[0].json.asqavReceipt.verificationUrl.includes('sig_1'), true);

	assert.strictEqual(out[1].json.b, 2);
	assert.strictEqual(out[1].json.asqavReceipt.signatureId, 'sig_2');

	// sign() received the right actionType/context per item.
	assert.strictEqual(signCalls[0].actionType, 'api:call');
	assert.deepStrictEqual(signCalls[0].context, { model: 'gpt-4' });
	assert.strictEqual(signCalls[1].actionType, 'tool:invoke');

	// pairedItem wired correctly.
	assert.deepStrictEqual(out[0].pairedItem, { item: 0 });
	assert.deepStrictEqual(out[1].pairedItem, { item: 1 });
});

test('parses a JSON string context value', async () => {
	signCalls.length = 0;
	const ctx = makeContext({
		items: [{ json: {} }],
		credentials: { apiKey: 'sk' },
		continueOnFail: false,
		params: [{ actionType: 'api:call', context: '{"k":"v"}', options: {} }],
	});
	const node = new Asqav();
	const result = await node.execute.call(ctx);
	assert.strictEqual(result[0][0].json.asqavReceipt.signatureId, 'sig_1');
	assert.deepStrictEqual(signCalls[0].context, { k: 'v' });
});

test('continueOnFail passes failing item through with an error field', async () => {
	signCalls.length = 0;

	// Reinstall an SDK mock whose sign() throws on the first item.
	const sdkPath = require.resolve('@asqav/sdk', { paths: [PKG_ROOT] });
	let call = 0;
	require.cache[sdkPath].exports.Agent.create = async (opts) => ({
		name: opts.name,
		async sign(signOptions) {
			call += 1;
			if (call === 1) {
				throw new Error('boom from sign');
			}
			return { signatureId: `sig_${call}`, verificationUrl: 'u', actionId: 'a', signature: 's', timestamp: 't' };
		},
	});

	const items = [{ json: { a: 1 } }, { json: { b: 2 } }];
	const ctx = makeContext({
		items,
		credentials: { apiKey: 'sk' },
		continueOnFail: true,
		params: [
			{ actionType: 'api:call', context: {}, options: {} },
			{ actionType: 'api:call', context: {}, options: {} },
		],
	});

	const node = new Asqav();
	const result = await node.execute.call(ctx);
	const out = result[0];

	assert.strictEqual(out.length, 2);
	// First item failed -> error field, original json preserved, no receipt.
	assert.strictEqual(out[0].json.a, 1);
	assert.strictEqual(out[0].json.error, 'boom from sign');
	assert.strictEqual(out[0].json.asqavReceipt, undefined);
	// Second item succeeded.
	assert.strictEqual(out[1].json.asqavReceipt.signatureId, 'sig_2');
});
