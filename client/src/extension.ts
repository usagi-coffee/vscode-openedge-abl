import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as os from 'os';
import { ExtensionContext, window, workspace } from 'vscode';
import {
	Executable,
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
} from 'vscode-languageclient/node';

const RELEASE_API_URL = 'https://api.github.com/repos/usagi-coffee/abl-language-server/releases/latest';
const SERVER_NAME = 'abl-language-server';

interface GithubReleaseAsset {
	name: string;
	browser_download_url: string;
}

interface GithubRelease {
	tag_name: string;
	assets: GithubReleaseAsset[];
}

let client: LanguageClient;

function httpGetJson<T>(url: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const request = https.get(
			url,
			{
				headers: {
					'User-Agent': 'vscode-openedge-abl',
					'Accept': 'application/vnd.github+json',
				},
			},
			(response) => {
				if (!response.statusCode || response.statusCode >= 400) {
					reject(new Error(`HTTP ${response.statusCode ?? 'unknown'} while requesting ${url}`));
					return;
				}

				let body = '';
				response.setEncoding('utf8');
				response.on('data', (chunk) => {
					body += chunk;
				});
				response.on('end', () => {
					try {
						resolve(JSON.parse(body) as T);
					} catch (error) {
						reject(error);
					}
				});
			}
		);

		request.on('error', reject);
	});
}

function downloadFile(url: string, destinationPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = https.get(
			url,
			{
				headers: {
					'User-Agent': 'vscode-openedge-abl',
					'Accept': '*/*',
				},
			},
			(response) => {
				if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
					response.resume();
					downloadFile(response.headers.location, destinationPath).then(resolve, reject);
					return;
				}

				if (!response.statusCode || response.statusCode >= 400) {
					reject(new Error(`HTTP ${response.statusCode ?? 'unknown'} while downloading ${url}`));
					return;
				}

				const fileStream = fsSync.createWriteStream(destinationPath);
				response.pipe(fileStream);
				fileStream.on('finish', () => {
					fileStream.close((error) => {
						if (error) {
							reject(error);
							return;
						}
						resolve();
					});
				});
				fileStream.on('error', reject);
			}
		);

		request.on('error', reject);
	});
}

function binaryName(): string {
	return os.platform() === 'win32' ? `${SERVER_NAME}.exe` : SERVER_NAME;
}

function releasePlatformName(platform: NodeJS.Platform): string {
	switch (platform) {
		case 'darwin':
			return 'macos';
		case 'linux':
			return 'linux';
		case 'win32':
			return 'windows';
		default:
			throw new Error(`Unsupported platform: ${platform}`);
	}
}

function releaseArchName(arch: string): string {
	switch (arch) {
		case 'x64':
			return 'x86_64';
		case 'arm64':
			return 'aarch64';
		case 'ia32':
		case 'x32':
			return 'x86_64';
		default:
			throw new Error(`Unsupported architecture: ${arch}`);
	}
}

function assetName(): string {
	const platform = releasePlatformName(os.platform());
	const arch = releaseArchName(os.arch());
	return `${SERVER_NAME}-${platform}-${arch}${os.platform() === 'win32' ? '.exe' : ''}`;
}

function resolveConfiguredLanguageServerPath(rawPath: string): string {
	const trimmed = rawPath.trim();
	if (trimmed === '~') {
		return os.homedir();
	}
	if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
		return path.join(os.homedir(), trimmed.slice(2));
	}
	return path.resolve(trimmed);
}

async function ensureLanguageServerBinary(context: ExtensionContext): Promise<string> {
	const release = await httpGetJson<GithubRelease>(RELEASE_API_URL);
	const asset = release.assets.find((candidate) => candidate.name === assetName());
	if (!asset) {
		throw new Error(`No release asset found for ${assetName()}`);
	}

	const storageDir = context.globalStorageUri.fsPath;
	const activeVersionDirName = `${SERVER_NAME}-${release.tag_name}`;
	const versionDir = path.join(storageDir, activeVersionDirName);
	const executablePath = path.join(versionDir, binaryName());

	await fs.mkdir(versionDir, { recursive: true });
	try {
		await fs.access(executablePath);
		await cleanupOldLanguageServerVersions(storageDir, activeVersionDirName);
		return executablePath;
	} catch {
		// Keep going and download
	}

	const downloadedPath = path.join(versionDir, asset.name);
	await downloadFile(asset.browser_download_url, downloadedPath);
	if (downloadedPath !== executablePath) {
		await fs.rename(downloadedPath, executablePath);
	}
	if (os.platform() !== 'win32') {
		await fs.chmod(executablePath, 0o755);
	}
	await cleanupOldLanguageServerVersions(storageDir, activeVersionDirName);

	return executablePath;
}

async function cleanupOldLanguageServerVersions(storageDir: string, activeVersionDirName: string): Promise<void> {
	const versionDirPrefix = `${SERVER_NAME}-`;
	let entries: fsSync.Dirent[];
	try {
		entries = await fs.readdir(storageDir, { withFileTypes: true });
	} catch {
		return;
	}

	const staleVersions = entries.filter(
		(entry) =>
			entry.isDirectory() &&
			entry.name.startsWith(versionDirPrefix) &&
			entry.name !== activeVersionDirName
	);

	await Promise.all(
		staleVersions.map(async (entry) => {
			try {
				await fs.rm(path.join(storageDir, entry.name), { recursive: true, force: true });
			} catch {
				// Best-effort cleanup: ignore stale version removal failures (e.g. locked files on Windows).
			}
		})
	);
}

export async function activate(context: ExtensionContext) {
	const extensionOutput = window.createOutputChannel('OpenEdge ABL');
	context.subscriptions.push(extensionOutput);

	try {
		const configuredPath = workspace.getConfiguration('openedgeAbl').get<string>('languageServerPath');
		const commandPath = configuredPath && configuredPath.trim().length > 0
			? resolveConfiguredLanguageServerPath(configuredPath)
			: await ensureLanguageServerBinary(context);
		extensionOutput.appendLine(`Starting ${SERVER_NAME} from: ${commandPath}`);
		extensionOutput.appendLine(`Using configured path: ${configuredPath && configuredPath.trim().length > 0 ? 'yes' : 'no'}`);
		if (configuredPath && configuredPath.trim().length > 0) {
			await fs.access(commandPath);
		}
		const executable: Executable = {
			command: commandPath,
			args: ['--stdio'],
		};
		const serverOptions: ServerOptions = {
			run: executable,
			debug: executable,
		};

		const clientOptions: LanguageClientOptions = {
			documentSelector: [
				{ scheme: 'file', language: 'abl' },
				{ scheme: 'file', language: 'openedgeabl' },
			],
			outputChannel: extensionOutput,
			traceOutputChannel: extensionOutput,
		};

		client = new LanguageClient(
			'ablLanguageServer',
			'ABL Language Server',
			serverOptions,
			clientOptions
		);

		client.start();
		context.subscriptions.push(client);
		extensionOutput.appendLine('Language client started.');
	} catch (error) {
		extensionOutput.appendLine(`Startup failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
		window.showErrorMessage(`Failed to start ${SERVER_NAME}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
