import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import axios from 'axios';

// Helper functions
async function getAppRoleToken(this: IExecuteFunctions, credentials: any) {
	try {
		const loginData = {
			role_id: credentials.roleId,
			secret_id: credentials.secretId,
		};

		const appRolePath = credentials.appRolePath || 'approle';
		const config = {
			method: 'POST' as const,
			url: `${credentials.url}/v1/auth/${appRolePath}/login`,
			data: loginData,
			headers: {
				'Content-Type': 'application/json',
				...(credentials.namespace && { 'X-Vault-Namespace': credentials.namespace }),
			},
		};

		if (credentials.allowUnauthorizedCerts) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
		}

		const response = await axios(config);

		if (!response.data.auth?.client_token) {
			throw new NodeOperationError(this.getNode(), 'Failed to obtain token from AppRole login');
		}

		return response.data.auth.client_token;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		throw new NodeOperationError(this.getNode(), `AppRole authentication failed: ${errorMessage}`);
	}
}

async function readSecret(this: IExecuteFunctions, config: any, secretEngine: string, credentials: any, itemIndex: number) {
	const secretPath = this.getNodeParameter('secretPath', itemIndex) as string;
	const version = this.getNodeParameter('version', itemIndex) as number;
	const apiVersion = credentials.apiVersion;

	let url: string;
	if (apiVersion === 'v2') {
		url = `/v1/${secretEngine}/data/${secretPath}`;
		if (version > 0) {
			url += `?version=${version}`;
		}
	} else {
		url = `/v1/${secretEngine}/${secretPath}`;
	}

	try {
		const response = await axios({
			...config,
			method: 'GET',
			url,
		});

		if (apiVersion === 'v2') {
			return {
				data: response.data.data?.data || {},
				metadata: response.data.data?.metadata || {},
				lease_duration: response.data.lease_duration,
				renewable: response.data.renewable,
			};
		} else {
			return {
				data: response.data.data || {},
				lease_duration: response.data.lease_duration,
				renewable: response.data.renewable,
			};
		}
	} catch (error: any) {
		const errorMessage = error.response?.data?.errors?.[0] || (error instanceof Error ? error.message : 'Unknown error');
		throw new NodeOperationError(this.getNode(), `Failed to read secret: ${errorMessage}`);
	}
}

async function writeSecret(this: IExecuteFunctions, config: any, secretEngine: string, credentials: any, itemIndex: number) {
	const secretPath = this.getNodeParameter('secretPath', itemIndex) as string;
	const secretData = this.getNodeParameter('secretData', itemIndex) as string;
	const apiVersion = credentials.apiVersion;

	let parsedData: any;
	try {
		parsedData = JSON.parse(secretData);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), 'Secret data must be valid JSON');
	}

	let url: string;
	let requestData: any;

	if (apiVersion === 'v2') {
		url = `/v1/${secretEngine}/data/${secretPath}`;
		requestData = {
			data: parsedData,
		};
	} else {
		url = `/v1/${secretEngine}/${secretPath}`;
		requestData = parsedData;
	}

	try {
		const response = await axios({
			...config,
			method: 'POST',
			url,
			data: requestData,
		});

		return {
			success: true,
			path: secretPath,
			...(response.data.data && { metadata: response.data.data }),
		};
	} catch (error: any) {
		const errorMessage = error.response?.data?.errors?.[0] || (error instanceof Error ? error.message : 'Unknown error');
		throw new NodeOperationError(this.getNode(), `Failed to write secret: ${errorMessage}`);
	}
}

async function deleteSecret(this: IExecuteFunctions, config: any, secretEngine: string, credentials: any, itemIndex: number) {
	const secretPath = this.getNodeParameter('secretPath', itemIndex) as string;
	const apiVersion = credentials.apiVersion;

	let url: string;
	if (apiVersion === 'v2') {
		url = `/v1/${secretEngine}/metadata/${secretPath}`;
	} else {
		url = `/v1/${secretEngine}/${secretPath}`;
	}

	try {
		await axios({
			...config,
			method: 'DELETE',
			url,
		});

		return {
			success: true,
			deleted: true,
			path: secretPath,
		};
	} catch (error: any) {
		const errorMessage = error.response?.data?.errors?.[0] || (error instanceof Error ? error.message : 'Unknown error');
		throw new NodeOperationError(this.getNode(), `Failed to delete secret: ${errorMessage}`);
	}
}

async function listSecrets(this: IExecuteFunctions, config: any, secretEngine: string, itemIndex: number) {
	const listPath = this.getNodeParameter('listPath', itemIndex, '') as string;
	const url = `/v1/${secretEngine}/metadata/${listPath}?list=true`;

	try {
		const response = await axios({
			...config,
			method: 'GET',
			url,
		});

		return {
			keys: response.data.data?.keys || [],
			path: listPath,
		};
	} catch (error: any) {
		const errorMessage = error.response?.data?.errors?.[0] || (error instanceof Error ? error.message : 'Unknown error');
		throw new NodeOperationError(this.getNode(), `Failed to list secrets: ${errorMessage}`);
	}
}

export class HashiCorpVault implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'HashiCorp Vault',
		name: 'hashiCorpVault',
		icon: 'file:hashicorp.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with HashiCorp Vault to manage secrets',
		defaults: {
			name: 'HashiCorp Vault',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'hashiCorpVaultApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Read Secret',
						value: 'readSecret',
						description: 'Read a secret from Vault',
						action: 'Read a secret from Vault',
					},
					{
						name: 'Write Secret',
						value: 'writeSecret',
						description: 'Write a secret to Vault',
						action: 'Write a secret to Vault',
					},
					{
						name: 'Delete Secret',
						value: 'deleteSecret',
						description: 'Delete a secret from Vault',
						action: 'Delete a secret from Vault',
					},
					{
						name: 'List Secrets',
						value: 'listSecrets',
						description: 'List secrets at a path',
						action: 'List secrets at a path',
					},
				],
				default: 'readSecret',
			},
			{
				displayName: 'Secret Engine',
				name: 'secretEngine',
				type: 'string',
				default: 'secret',
				placeholder: 'secret',
				description: 'The name of the secrets engine (mount path)',
				required: true,
			},
			{
				displayName: 'Secret Path',
				name: 'secretPath',
				type: 'string',
				default: '',
				placeholder: 'myapp/database',
				description: 'The path to the secret within the secrets engine',
				required: true,
				displayOptions: {
					show: {
						operation: ['readSecret', 'writeSecret', 'deleteSecret'],
					},
				},
			},
			{
				displayName: 'List Path',
				name: 'listPath',
				type: 'string',
				default: '',
				placeholder: 'myapp/',
				description: 'The path to list secrets from',
				displayOptions: {
					show: {
						operation: ['listSecrets'],
					},
				},
			},
			{
				displayName: 'Secret Data',
				name: 'secretData',
				type: 'json',
				default: '{\n  "username": "myuser",\n  "password": "mypassword"\n}',
				description: 'The secret data to write (JSON format)',
				displayOptions: {
					show: {
						operation: ['writeSecret'],
					},
				},
				required: true,
			},
			{
				displayName: 'Version',
				name: 'version',
				type: 'number',
				default: 0,
				description: 'Version of the secret to read (0 for latest)',
				displayOptions: {
					show: {
						operation: ['readSecret'],
					},
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Custom Headers',
						name: 'customHeaders',
						type: 'json',
						default: '{}',
						description: 'Custom headers to send with the request',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						default: 30000,
						description: 'Request timeout in milliseconds',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const credentials = await this.getCredentials('hashiCorpVaultApi');
				const operation = this.getNodeParameter('operation', i) as string;
				const secretEngine = this.getNodeParameter('secretEngine', i) as string;
				const additionalFields = this.getNodeParameter('additionalFields', i) as any;

				// Get authentication token
				let vaultToken: string;
				if (credentials.authMethod === 'appRole') {
					vaultToken = await getAppRoleToken.call(this, credentials);
				} else {
					vaultToken = credentials.token as string;
				}

				// Base configuration for axios
				const baseConfig = {
					baseURL: credentials.url as string,
					timeout: additionalFields.timeout || 30000,
					headers: {
						'X-Vault-Token': vaultToken,
						'Content-Type': 'application/json',
						...(credentials.namespace && { 'X-Vault-Namespace': credentials.namespace as string }),
						...(additionalFields.customHeaders && JSON.parse(additionalFields.customHeaders)),
					},
				};

				if (credentials.allowUnauthorizedCerts) {
					process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
				}

				let responseData: any;

				switch (operation) {
					case 'readSecret':
						responseData = await readSecret.call(this, baseConfig, secretEngine, credentials, i);
						break;
					case 'writeSecret':
						responseData = await writeSecret.call(this, baseConfig, secretEngine, credentials, i);
						break;
					case 'deleteSecret':
						responseData = await deleteSecret.call(this, baseConfig, secretEngine, credentials, i);
						break;
					case 'listSecrets':
						responseData = await listSecrets.call(this, baseConfig, secretEngine, i);
						break;
					default:
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
				}

				returnData.push({
					json: responseData,
					pairedItem: {
						item: i,
					},
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : 'Unknown error occurred',
						},
						pairedItem: {
							item: i,
						},
					});
					continue;
				}
				throw error;
			}
		}

		// Reset SSL behavior
		if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
			delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
		}

		return [returnData];
	}
}