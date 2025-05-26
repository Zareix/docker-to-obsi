import { TFile } from "obsidian";
import type { DockerStackFile } from "src/github";
import type DockerToObsiPlugin from "src/main";

type Frontmatter = {
	[key: string]: string | undefined;
};

export default class ObsidianService {
	private readonly plugin: DockerToObsiPlugin;

	constructor(plugin: DockerToObsiPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Iterates over all note files in the obsidian vault and updates the first YAML code block
	 * with the content from matching Docker stacks.
	 * Returns the number of files that were successfully updated.
	 */
	async checkNotesForMatchingStacks(
		stacks: DockerStackFile[],
	): Promise<number> {
		const stackMap = new Map(
			stacks.map((stack) => [stack.name, stack.content]),
		);
		const allFiles = this.getMarkdownFiles();

		// Process all files in parallel
		const updatePromises = allFiles.map(async (file) => {
			try {
				const frontmatter = await this.getFrontmatter(file.path);
				const propertyName = this.plugin.settings.frontmatterProperty;
				const stackName = frontmatter?.[propertyName];

				if (!stackName) {
					return false;
				}

				const stackContent = stackMap.get(stackName);
				if (!stackContent) {
					return false;
				}

				return await this.updateYamlCodeBlock(file, stackContent);
			} catch (error) {
				console.error(`Failed to process file ${file.path}:`, error);
				return false;
			}
		});

		// Wait for all updates to complete and count successful ones
		const results = await Promise.all(updatePromises);
		const updatedCount = results.filter((success) => success).length;

		return updatedCount;
	}

	async getFrontmatter(filePath: string): Promise<Frontmatter | null> {
		return new Promise((resolve, reject) => {
			const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
			if (!file || !(file instanceof TFile)) {
				console.error(`File not found or is not a markdown file: ${filePath}`);
				return null;
			}
			try {
				this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
					resolve(frontmatter as Frontmatter);
				});
			} catch (error) {
				console.error(
					`Failed to read frontmatter from file ${filePath}:`,
					error,
				);
				reject(error);
			}
		});
	}

	/**
	 * Updates the first YAML code block with compose title in a markdown file with new content.
	 */
	async updateYamlCodeBlock(file: TFile, newContent: string): Promise<boolean> {
		const content = await this.plugin.app.vault.read(file);

		// Matches: YAML Codeblock with title: compose.yaml, docker-compose.yaml, compose.yml, docker-compose.yml
		const yamlCodeBlockRegex =
			/^```ya?ml\s+title=(docker-)?compose\.ya?ml\r?\n([\s\S]*?)\n```/m;
		const match = content.match(yamlCodeBlockRegex);

		if (!match) {
			console.warn(
				`No YAML code block with compose title found in file: ${file.path}`,
			);
			return false;
		}

		const oldCodeBlock = match[0];
		const newCodeBlock = `\`\`\`yaml title=compose.yaml\n${newContent.trim()}\n\`\`\``;
		const updatedContent = content.replace(oldCodeBlock, newCodeBlock);

		await this.plugin.app.vault.modify(file, updatedContent);
		return true;
	}

	/**
	 * Gets markdown files from the vault, optionally filtered by folder path setting.
	 */
	private getMarkdownFiles(): TFile[] {
		const folderPath = this.plugin.settings.folderPath.trim();

		if (!folderPath) {
			return this.plugin.app.vault.getMarkdownFiles();
		}

		const allFiles = this.plugin.app.vault.getMarkdownFiles();
		return allFiles.filter((file) => file.path.startsWith(folderPath));
	}
}
