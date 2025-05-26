import type DockerToObsiPlugin from "src/main";

export type DockerStackFile = {
	name: string;
	content: string;
};

export default class GithubService {
	private readonly plugin: DockerToObsiPlugin;

	constructor(plugin: DockerToObsiPlugin) {
		this.plugin = plugin;
	}

	async fetchGithubFileContent(filePath: string): Promise<string> {
		const { ghUsername, ghRepository, ghToken } = this.plugin.settings;
		const url = `https://api.github.com/repos/${ghUsername}/${ghRepository}/contents/${filePath}?ref=main`;
		const res = await fetch(url, {
			headers: {
				Accept: "application/vnd.github.v3.raw",
				Authorization: `token ${ghToken}`,
			},
		});
		if (!res.ok) {
			throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`);
		}
		return await res.text();
	}

	/**
	 * Recursively fetches all files in the repo that match "compose.yaml" in their name.
	 */
	async fetchComposeYamlFiles(path = ""): Promise<string[]> {
		const { ghUsername, ghRepository, ghToken } = this.plugin.settings;
		const url = `https://api.github.com/repos/${ghUsername}/${ghRepository}/contents/${path}?ref=main`;
		const res = await fetch(url, {
			headers: {
				Accept: "application/vnd.github.v3+json",
				Authorization: `token ${ghToken}`,
			},
		});
		if (!res.ok) {
			throw new Error(
				`Failed to list directory: ${res.status} ${res.statusText}`,
			);
		}
		const items = await res.json();
		const directories: string[] = [];
		let files: string[] = [];

		for (const item of items) {
			if (item.type === "file" && item.name.includes("compose.yaml")) {
				files.push(item.path);
			} else if (item.type === "dir") {
				directories.push(item.path);
			}
		}

		// Process all directories in parallel
		if (directories.length > 0) {
			const subFileResults = await Promise.all(
				directories.map((dir) => this.fetchComposeYamlFiles(dir)),
			);

			// Flatten the results
			for (const subFiles of subFileResults) {
				files = files.concat(subFiles);
			}
		}

		return files;
	}

	/**
	 * Fetch all compose.yaml files in the repo and return as DockerStackFile objects.
	 */
	async fetchAllComposeStackFiles(): Promise<DockerStackFile[]> {
		const filePaths = await this.fetchComposeYamlFiles();

		const contentPromises = filePaths.map(async (path) => {
			const content = await this.fetchGithubFileContent(path);
			return {
				name:
					path.replace("/compose.yaml", "").split("/").pop() || "__unknown__",
				content,
			};
		});

		return await Promise.all(contentPromises);
	}
}
