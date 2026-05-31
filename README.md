# n8n-nodes-asqav

Stop a rogue agent before it acts, and prove what it tried. This is an n8n community node that sends each workflow action to Asqav for a policy decision before it commits, and attaches a verifiable record to the item.

Asqav is an AI agent governance service. It checks the action against your policies and signs the outcome server-side with post-quantum cryptography (ML-DSA): a permitted action returns a receipt you can verify independently, and a denied action is refused at the API with a forensic record of the attempt rather than a permissive receipt. This node wraps the Asqav TypeScript SDK (`@asqav/sdk`).

This node is built and maintained by the Asqav team.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. Install by the npm package name:

```
n8n-nodes-asqav
```

## Operations

The node exposes a single operation, "Asqav: Sign Action". For every input item it:

1. Reads the configured action type and optional context.
2. Creates an Asqav agent and calls `agent.sign(...)`.
3. Appends the full signature response to `item.json.asqavReceipt`.

The receipt object includes `signatureId`, `actionId`, `signature`, `verificationUrl`, `chainHash`, and `timestamp`.

### Parameters

- Action Type (string, required): namespaced action identifier, for example `api:call`.
- Context (JSON, optional): object bound into the signed receipt. Sent verbatim.
- Options (collection, optional):
  - Agent Name (default `n8n`)
  - Receipt Type (IETF Compliance Receipts namespace)
  - Risk Class (`low`, `medium`, `high`, `unknown`)
  - Compliance Mode (boolean)

The node honours "Continue On Fail". When enabled, a failing item passes through with an `error` field instead of stopping the workflow.

## Credentials

Create an Asqav API key at [asqav.com](https://asqav.com) and add an "Asqav API" credential with that key. The credential test issues `GET https://api.asqav.com/api/v1/policies` with the `X-API-Key` header to confirm the key is valid.

## Compatibility

Built and tested against `n8n-workflow` 2.x and the `@n8n/node-cli` build tooling. Requires Node.js 20 or later (the runtime n8n ships with).

## Usage

Signing happens at execution time. n8n community nodes have no install or load hook, so a receipt is produced each time the node runs, once per input item.

An example template is included at [`workflows/sign-action-example.json`](workflows/sign-action-example.json). It wires:

```
Manual Trigger -> Action (Set) -> Asqav: Sign Action -> NoOp
```

Import it from the n8n canvas (Import from File), attach an Asqav API credential, and run. Each item leaving the Asqav node carries `asqavReceipt`.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Asqav](https://asqav.com)
- [@asqav/sdk on npm](https://www.npmjs.com/package/@asqav/sdk)
