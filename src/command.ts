import { Notice } from "obsidian";
import GithubService from "src/github";
import type DockerToObsiPlugin from "src/main";
import { StackSelectionModal } from "src/modal";
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

	async createMissingDockerNotesCommand() {
		const statusBarItemEl = this.plugin.addStatusBarItem();
		statusBarItemEl.setText("Fetching docker stacks...");

		try {
			const stacks = await this.githubService.fetchAllComposeStackFiles();
			if (stacks.length === 0) {
				new Notice("No Docker stacks found.");
				return;
			}

			statusBarItemEl.setText("Finding missing Docker stack notes...");
			const missingStacks =
				await this.obsidianService.findMissingStacks(stacks);

			if (missingStacks.length === 0) {
				new Notice("All Docker stacks already have corresponding notes.");
				return;
			}

			statusBarItemEl.remove();

			const modal = new StackSelectionModal(
				this.plugin.app,
				this.plugin,
				this.obsidianService,
				missingStacks,
				async (selectedStacks) => {
					if (selectedStacks.length === 0) {
						new Notice("No stacks selected for creation.");
						return;
					}

					const creationStatusBar = this.plugin.addStatusBarItem();
					creationStatusBar.setText("Creating notes from template...");

					try {
						const createdCount =
							await this.obsidianService.createNotesFromTemplate(
								selectedStacks,
							);

						if (createdCount > 0) {
							new Notice(
								`Successfully created ${createdCount} new note${createdCount === 1 ? "" : "s"} for Docker stacks.`,
							);
						} else {
							new Notice("Failed to create notes. Check console for errors.");
						}
					} catch (err) {
						console.error("Error creating Docker notes:", err);
						new Notice(
							"Failed to create Docker notes. Check console for details.",
						);
					} finally {
						creationStatusBar.remove();
					}
				},
			);

			modal.open();
		} catch (err) {
			console.error("Error creating Docker notes:", err);
			new Notice("Failed to create Docker notes. Check console for details.");
		} finally {
			statusBarItemEl.remove();
		}
	}
}
