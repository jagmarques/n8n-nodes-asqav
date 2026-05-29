import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { Agent, init } from '@asqav/sdk';

export class Asqav implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Asqav: Sign Action',
		name: 'asqav',
		icon: { light: 'file:asqav.svg', dark: 'file:asqav.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["actionType"]}}',
		description: 'Sign a workflow action with Asqav and attach a verifiable compliance receipt',
		defaults: {
			name: 'Asqav: Sign Action',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'asqavApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Action Type',
				name: 'actionType',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'api:call',
				description:
					'Namespaced action identifier to sign, for example "api:call" or "tool:invoke"',
			},
			{
				displayName: 'Context',
				name: 'context',
				type: 'json',
				default: '{}',
				description:
					'Optional JSON object of action context. Sent verbatim to Asqav and bound into the signed receipt.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Agent Name',
						name: 'agentName',
						type: 'string',
						default: 'n8n',
						description: 'Name of the signing agent registered with Asqav',
					},
					{
						displayName: 'Receipt Type',
						name: 'receiptType',
						type: 'options',
						default: 'protectmcp:decision',
						description: 'Receipt namespace per the IETF Compliance Receipts profile',
						options: [
							{ name: 'Acknowledgment', value: 'protectmcp:acknowledgment' },
							{ name: 'Decision', value: 'protectmcp:decision' },
							{ name: 'Lifecycle', value: 'protectmcp:lifecycle' },
							{ name: 'Observation', value: 'protectmcp:observation' },
							{ name: 'Restraint', value: 'protectmcp:restraint' },
						],
					},
					{
						displayName: 'Risk Class',
						name: 'riskClass',
						type: 'options',
						default: 'unknown',
						description: 'Risk classification stamped on the receipt',
						options: [
							{ name: 'Unknown', value: 'unknown' },
							{ name: 'Low', value: 'low' },
							{ name: 'Medium', value: 'medium' },
							{ name: 'High', value: 'high' },
						],
					},
					{
						displayName: 'Compliance Mode',
						name: 'complianceMode',
						type: 'boolean',
						default: false,
						description:
							'Whether to emit the receipt under the IETF Compliance Receipts profile (fail-closed anchoring, raised retention)',
					},
				],
			},
		],
	};

	// Signing happens here, on execute. n8n community nodes have no install or
	// load-time hook, so every receipt is produced as the workflow runs.
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('asqavApi');
		const apiKey = credentials.apiKey as string;

		// init() sets module-global SDK config; call it per execution because the
		// config is mutable global state that another node could have changed.
		init({ apiKey });

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const actionType = this.getNodeParameter('actionType', itemIndex) as string;
				const contextParam = this.getNodeParameter('context', itemIndex, {}) as
					| Record<string, unknown>
					| string;
				const options = this.getNodeParameter('options', itemIndex, {}) as {
					agentName?: string;
					receiptType?: string;
					riskClass?: string;
					complianceMode?: boolean;
				};

				let context: Record<string, unknown> = {};
				if (typeof contextParam === 'string') {
					const trimmed = contextParam.trim();
					context = trimmed === '' ? {} : (JSON.parse(trimmed) as Record<string, unknown>);
				} else if (contextParam && typeof contextParam === 'object') {
					context = contextParam;
				}

				const agent = await Agent.create({ name: options.agentName ?? 'n8n' });

				const signOptions: Parameters<typeof agent.sign>[0] = { actionType, context };
				if (options.receiptType) {
					signOptions.receiptType = options.receiptType as typeof signOptions.receiptType;
				}
				if (options.riskClass) {
					signOptions.riskClass = options.riskClass as typeof signOptions.riskClass;
				}
				if (options.complianceMode) {
					signOptions.complianceMode = options.complianceMode;
				}

				const res = await agent.sign(signOptions);

				const newItem: INodeExecutionData = {
					json: { ...items[itemIndex].json, asqavReceipt: res },
					pairedItem: { item: itemIndex },
				};
				if (items[itemIndex].binary !== undefined) {
					newItem.binary = items[itemIndex].binary;
				}
				returnData.push(newItem);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { ...items[itemIndex].json, error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}
