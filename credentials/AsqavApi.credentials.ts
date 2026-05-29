import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AsqavApi implements ICredentialType {
	name = 'asqavApi';

	displayName = 'Asqav API';

	icon: Icon = {
		light: 'file:../nodes/Asqav/asqav.svg',
		dark: 'file:../nodes/Asqav/asqav.dark.svg',
	};

	documentationUrl = 'https://asqav.com';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your Asqav API key. Create one at asqav.com.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.asqav.com/api/v1',
			url: '/policies',
			method: 'GET',
		},
	};
}
