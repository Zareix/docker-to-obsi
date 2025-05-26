import { Notice } from "obsidian";
import GithubService from "src/github";
import type DockerToObsiPlugin from "src/main";
import ObsidianService from "src/obsidian";

export default class CommandManager {
	private readonly plugin: DockerToObsiPlugin;
	private readonly githubService: GithubService;
	private readonly obsidianService: ObsidianService;

	constructor(plugin: DockerToObsiPlugin) {
		this.plugin = plugin;
		this.githubService = new GithubService(plugin);
		this.obsidianService = new ObsidianService(plugin);
	}

	async dockerToObsiCommand() {
		const statusBarItemEl = this.plugin.addStatusBarItem();
		statusBarItemEl.setText("Fetching docker stacks...");

		try {
			const stacks = await this.githubService.fetchAllComposeStackFiles();
			if (stacks.length === 0) {
				new Notice("No Docker stacks found.");
				return;
			}

			new Notice(`Found ${stacks.length} Docker stacks.`);
			statusBarItemEl.setText("Updating docker stacks in obsidian files...");

			const updatedCount =
				await this.obsidianService.checkNotesForMatchingStacks(stacks);

			if (updatedCount > 0) {
				new Notice(
					`Successfully updated ${updatedCount} note${updatedCount === 1 ? "" : "s"} with Docker stack content.`,
				);
			} else {
				new Notice("No matching notes found to update.");
			}
		} catch (err) {
			new Notice("Failed to fetch file content from GitHub.");
		} finally {
			statusBarItemEl.remove();
		}
	}
}
