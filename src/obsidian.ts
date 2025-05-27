import { TFile } from "obsidian";
import type { DockerStackFile } from "src/github";
import type DockerToObsiPlugin from "src/main";
import AIService from "src/ai";
import moment from "moment";

type Frontmatter = {
	[key: string]: string | undefined;
};

export default class ObsidianService {
	private readonly plugin: DockerToObsiPlugin;
	private readonly aiService: AIService;

	constructor(plugin: DockerToObsiPlugin) {
		this.plugin = plugin;
		this.aiService = new AIService(plugin);
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
	 * Sets a property in the frontmatter of a file using processFrontMatter.
	 */
	private async setFrontmatterProperty(
		file: TFile,
		propertyName: string,
		value: string | string[],
	): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
					frontmatter[propertyName] = value;
				});
				resolve();
			} catch (error) {
				console.error(
					`Failed to set frontmatter property ${propertyName} in file ${file.path}:`,
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

	/**
	 * Finds Docker stacks that don't have corresponding notes yet.
	 * Returns an array of stacks that need notes to be created.
	 */
	async findMissingStacks(
		stacks: DockerStackFile[],
	): Promise<DockerStackFile[]> {
		const allFiles = this.getMarkdownFiles();
		const existingStackNames = new Set<string>();

		const frontmatterPromises = allFiles.map(async (file) => {
			try {
				const frontmatter = await this.getFrontmatter(file.path);
				const stackName =
					frontmatter?.[this.plugin.settings.frontmatterProperty];
				if (stackName) {
					existingStackNames.add(stackName);
				}
			} catch (error) {
				console.error(`Failed to read frontmatter from ${file.path}:`, error);
			}
		});

		await Promise.all(frontmatterPromises);

		return stacks.filter((stack) => !existingStackNames.has(stack.name));
	}

	/**
	 * Creates new notes for the given Docker stacks using the configured template file.
	 * Returns the number of notes successfully created.
	 */
	async createNotesFromTemplate(stacks: DockerStackFile[]): Promise<number> {
		const templateFilePath = this.plugin.settings.templateFilePath.trim();

		if (!templateFilePath) {
			console.error("Template file path is not configured");
			return 0;
		}

		const templateFile =
			this.plugin.app.vault.getAbstractFileByPath(templateFilePath);
		if (!templateFile || !(templateFile instanceof TFile)) {
			console.error(`Template file not found: ${templateFilePath}`);
			return 0;
		}

		const templateContent = await this.plugin.app.vault.read(templateFile);

		// Check if template has tags property in frontmatter
		const templateFrontmatter = await this.getFrontmatter(templateFile.path);
		const templateHasTags =
			templateFrontmatter && "tags" in templateFrontmatter;

		const folderPath = this.plugin.settings.folderPath.trim();
		let createdCount = 0;

		for (const stack of stacks) {
			try {
				const noteContent = await this.processTemplate(templateContent, stack);
				const fileName = this.generateFileName(stack.name);
				const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

				const existingFile =
					this.plugin.app.vault.getAbstractFileByPath(filePath);
				if (existingFile) {
					console.warn(`File ${filePath} already exists, skipping creation`);
					continue;
				}

				const newFile = await this.plugin.app.vault.create(
					filePath,
					noteContent,
				);

				await this.setFrontmatterProperty(
					newFile,
					this.plugin.settings.frontmatterProperty,
					stack.name,
				);

				if (templateHasTags && this.plugin.settings.useAI) {
					const generatedTags = await this.aiService.generateStackTags(stack);
					await this.setFrontmatterProperty(newFile, "tags", generatedTags);
				}

				createdCount++;
			} catch (error) {
				console.error(`Failed to create note for stack ${stack.name}:`, error);
			}
		}

		return createdCount;
	}

	/**
	 * Generates a file name for a Docker stack using the configured prefix/suffix settings.
	 */
	generateFileName(stackName: string): string {
		const capitalizedName = this.capitalizeStackName(stackName);
		const { fileNamePrefix, fileNameSuffix } = this.plugin.settings;

		// Process date variables in prefix and suffix
		const processedPrefix = fileNamePrefix
			? this.processDateVariables(fileNamePrefix)
			: "";
		const processedSuffix = fileNameSuffix
			? this.processDateVariables(fileNameSuffix)
			: "";

		let fileName = capitalizedName;

		if (processedPrefix) {
			fileName = `${processedPrefix}${fileName}`;
		}

		if (processedSuffix) {
			fileName = `${fileName}${processedSuffix}`;
		}

		return `${fileName}.md`;
	}

	/**
	 * Processes the template by replacing placeholders with actual values.
	 */
	private async processTemplate(
		template: string,
		stack: DockerStackFile,
	): Promise<string> {
		let processedTemplate = template;
		if (processedTemplate.includes("{{stackContent}}")) {
			processedTemplate = processedTemplate.replace(
				/\{\{stackContent\}\}/g,
				stack.content,
			);
		} else {
			processedTemplate = this.processYamlCodeBlocks(
				processedTemplate,
				stack.content,
			);
		}

		let description = "Write description here";
		if (processedTemplate.includes("{{about}}") && this.plugin.settings.useAI) {
			description = await this.aiService.generateStackDescription(stack);
		}

		// Process date variables with flexible formatting
		processedTemplate = this.processDateVariables(processedTemplate);

		return processedTemplate
			.replace(/\{\{stackName\}\}/g, stack.name)
			.replace(/\{\{about\}\}/g, description);
	}

	/**
	 * Processes date variables in the template, supporting both {{date}} and {{date:format}} syntax.
	 */
	private processDateVariables(template: string): string {
		const now = moment();

		const dateFormatRegex = /\{\{date:([^}]+)\}\}/g;
		let processedTemplate = template.replace(
			dateFormatRegex,
			(match, format) => {
				try {
					return now.format(format);
				} catch (error) {
					console.warn(
						`Invalid date format "${format}", using default format`,
						error,
					);
					return now.format("YYYY/MM/DD");
				}
			},
		);

		processedTemplate = processedTemplate.replace(
			/\{\{date\}\}/g,
			now.format("YYYY/MM/DD"),
		);

		return processedTemplate;
	}

	/**
	 * Processes YAML code blocks in the template by updating compose.yaml blocks with stack content.
	 */
	private processYamlCodeBlocks(
		template: string,
		stackContent: string,
	): string {
		// Matches: YAML Codeblock with title: compose.yaml, docker-compose.yaml, compose.yml, docker-compose.yml
		const yamlCodeBlockRegex =
			/^```ya?ml\s+title=(docker-)?compose\.ya?ml\r?\n([\s\S]*?)\n```/gm;

		return template.replace(yamlCodeBlockRegex, () => {
			return `\`\`\`yaml title=compose.yaml\n${stackContent.trim()}\n\`\`\``;
		});
	}

	/**
	 * Capitalizes the stack name for use as a file name.
	 */
	private capitalizeStackName(stackName: string): string {
		return stackName
			.split(/[-_\s]+/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(" ");
	}
}
