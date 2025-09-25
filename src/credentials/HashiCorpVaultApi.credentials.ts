import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class HashiCorpVaultApi implements ICredentialType {
	name = 'hashiCorpVaultApi';
	displayName = 'HashiCorp Vault API';
	documentationUrl = 'https://www.vaultproject.io/api-docs';


	properties: INodeProperties[] = [
		{
			displayName: '📖 For complete setup instructions, Vault configuration examples, and troubleshooting guide, <a href="https://www.npmjs.com/package/n8n-nodes-hashi-vault" target="_blank">visit our documentation</a>',
			name: 'notice',
			type: 'notice',
			default: '',
		},
		{
			displayName: 'Vault URL',
			name: 'url',
			type: 'string',
			default: 'https://vault.example.com:8200',
			placeholder: 'https://vault.example.com:8200',
			description: 'The URL of your HashiCorp Vault instance',
			required: true,
		},
		{
			displayName: 'Authentication Method',
			name: 'authMethod',
			type: 'options',
			options: [
				{
					name: 'AppRole',
					value: 'appRole',
					description: 'Authenticate using AppRole method',
				},
				{
					name: 'Token',
					value: 'token',
					description: 'Authenticate using a Vault token',
				},
			],
			default: 'appRole',
			description: 'The authentication method to use with Vault',
		},
		{
			displayName: 'Role ID',
			name: 'roleId',
			type: 'string',
			default: '',
			placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
			description: 'The Role ID for AppRole authentication',
			displayOptions: {
				show: {
					authMethod: ['appRole'],
				},
			},
			required: true,
		},
		{
			displayName: 'Secret ID',
			name: 'secretId',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
			description: 'The Secret ID for AppRole authentication',
			displayOptions: {
				show: {
					authMethod: ['appRole'],
				},
			},
			required: true,
		},
		{
			displayName: 'AppRole Mount Path',
			name: 'appRolePath',
			type: 'string',
			default: 'approle',
			placeholder: 'approle',
			description: 'The mount path of the AppRole authentication method (e.g., approle, vault-n8n-workflow)',
			displayOptions: {
				show: {
					authMethod: ['appRole'],
				},
			},
			required: true,
		},
		{
			displayName: 'Token',
			name: 'token',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			placeholder: 'hvs.xxxxxxxxxxxxxxxxxxxxxx',
			description: 'The Vault token for authentication',
			displayOptions: {
				show: {
					authMethod: ['token'],
				},
			},
			required: true,
		},
		{
			displayName: 'Namespace',
			name: 'namespace',
			type: 'string',
			default: '',
			placeholder: 'my-namespace',
			description: 'The Vault namespace (Enterprise feature)',
		},
		{
			displayName: 'API Version',
			name: 'apiVersion',
			type: 'options',
			options: [
				{
					name: 'v1',
					value: 'v1',
				},
				{
					name: 'v2',
					value: 'v2',
				},
			],
			default: 'v2',
			description: 'The API version of the KV secrets engine',
		},
		{
			displayName: 'Ignore SSL Issues',
			name: 'allowUnauthorizedCerts',
			type: 'boolean',
			default: false,
			description: 'Whether to connect even if SSL certificate validation is not possible',
		},
	];
}