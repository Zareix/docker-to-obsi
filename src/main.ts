import {
	type App,
	Plugin,
	PluginSettingTab,
	Setting,
	type PluginManifest,
} from "obsidian";
import CommandManager from "src/command";

// Remember to rename these classes and interfaces!

interface DockerToObsiSettings {
	ghUsername: string;
	ghRepository: string;
	ghToken: string;
	folderPath: string;
	frontmatterProperty: string;
}

const DEFAULT_SETTINGS: DockerToObsiSettings = {
	ghUsername: "",
	ghRepository: "",
	ghToken: "",
	folderPath: "",
	frontmatterProperty: "stackName",
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
	}
}
