import {
	type App,
	Plugin,
	PluginSettingTab,
	Setting,
	type PluginManifest,
} from "obsidian";
import CommandManager from "src/command";

interface DockerToObsiSettings {
	ghUsername: string;
	ghRepository: string;
	ghToken: string;
	folderPath: string;
	frontmatterProperty: string;
	templateFilePath: string;
	useAI: boolean;
	openaiApiKey: string;
	fileNamePrefix: string;
	fileNameSuffix: string;
}

const DEFAULT_SETTINGS: DockerToObsiSettings = {
	ghUsername: "",
	ghRepository: "",
	ghToken: "",
	folderPath: "",
	frontmatterProperty: "stackName",
	templateFilePath: "",
	useAI: false,
	openaiApiKey: "",
	fileNamePrefix: "",
	fileNameSuffix: "",
};

export default class DockerToObsiPlugin extends Plugin {
	settings: DockerToObsiSettings;
	private commandManager: CommandManager;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
		this.commandManager = new CommandManager(this);
	}

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "run-docker-to-obsi",
			name: "Fetch docker stacks and save to Obsidian",
			callback: async () => this.commandManager.dockerToObsiCommand(),
		});

		this.addCommand({
			id: "create-missing-docker-notes",
			name: "Create notes for missing Docker stacks",
			callback: async () =>
				this.commandManager.createMissingDockerNotesCommand(),
		});

		this.addSettingTab(new SettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SettingTab extends PluginSettingTab {
	plugin: DockerToObsiPlugin;

	constructor(app: App, plugin: DockerToObsiPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setHeading().setName("GitHub");
		new Setting(containerEl).setName("Github Username").addText((text) =>
			text
				.setPlaceholder("Username")
				.setValue(this.plugin.settings.ghUsername)
				.onChange(async (value) => {
					this.plugin.settings.ghUsername = value;
					await this.plugin.saveSettings();
				}),
		);
		new Setting(containerEl).setName("Github Repository").addText((text) =>
			text
				.setPlaceholder("Repository")
				.setValue(this.plugin.settings.ghRepository)
				.onChange(async (value) => {
					this.plugin.settings.ghRepository = value;
					await this.plugin.saveSettings();
				}),
		);
		new Setting(containerEl).setName("Github Token").addText((text) =>
			text
				.setPlaceholder("Token")
				.setValue(this.plugin.settings.ghToken)
				.onChange(async (value) => {
					this.plugin.settings.ghToken = value;
					await this.plugin.saveSettings();
				}),
		);

		new Setting(containerEl).setHeading().setName("Obsidian");
		new Setting(containerEl)
			.setName("Folder Path")
			.setDesc(
				"Path to folder where to look for markdown files (leave empty for entire vault)",
			)
			.addText((text) =>
				text
					.setPlaceholder("path/to/folder/")
					.setValue(this.plugin.settings.folderPath)
					.onChange(async (value) => {
						this.plugin.settings.folderPath = value;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName("Frontmatter Property")
			.setDesc(
				"Name of the frontmatter property to look for in notes (default: stackName)",
			)
			.addText((text) =>
				text
					.setPlaceholder("stackName")
					.setValue(this.plugin.settings.frontmatterProperty)
					.onChange(async (value) => {
						this.plugin.settings.frontmatterProperty = value;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName("Template File Path")
			.setDesc(
				"Path to the template file for creating new Docker stack notes (e.g., Templates/Docker Template.md)",
			)
			.addText((text) =>
				text
					.setPlaceholder("Templates/Docker Template.md")
					.setValue(this.plugin.settings.templateFilePath)
					.onChange(async (value) => {
						this.plugin.settings.templateFilePath = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("File Name Prefix")
			.setDesc(
				"Text to add at the beginning of newly created file names (e.g., 'Docker -' or date format like 'YYYY-MM-DD -')",
			)
			.addText((text) =>
				text
					.setPlaceholder("Docker - ")
					.setValue(this.plugin.settings.fileNamePrefix)
					.onChange(async (value) => {
						this.plugin.settings.fileNamePrefix = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("File Name Suffix")
			.setDesc(
				"Text to add at the end of newly created file names (e.g., ' - Stack' or ' (Auto-Generated)')",
			)
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.fileNameSuffix)
					.onChange(async (value) => {
						this.plugin.settings.fileNameSuffix = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setHeading().setName("AI");

		new Setting(containerEl)
			.setName("Use AI")
			.setDesc("Enable AI-powered descriptions for Docker stacks using OpenAI")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useAI).onChange(async (value) => {
					this.plugin.settings.useAI = value;
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		if (this.plugin.settings.useAI) {
			new Setting(containerEl)
				.setName("OpenAI API Key")
				.setDesc(
					"Your OpenAI API key for generating AI descriptions (required when AI is enabled)",
				)
				.addText((text) =>
					text
						.setPlaceholder("sk-...")
						.setValue(this.plugin.settings.openaiApiKey)
						.onChange(async (value) => {
							this.plugin.settings.openaiApiKey = value;
							await this.plugin.saveSettings();
						}),
				);
		}
	}
}
