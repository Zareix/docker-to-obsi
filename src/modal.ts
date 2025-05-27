import type { App } from "obsidian";
import { Modal } from "obsidian";
import type { DockerStackFile } from "src/github";
import type DockerToObsiPlugin from "src/main";
import moment from "moment";
import type ObsidianService from "src/obsidian";

export class StackSelectionModal extends Modal {
	private plugin: DockerToObsiPlugin;
	private readonly obsidianService: ObsidianService;
	private stacks: DockerStackFile[];
	private selectedStacks: Set<string>;
	private onSubmit: (selectedStacks: DockerStackFile[]) => void;

	constructor(
		app: App,
		plugin: DockerToObsiPlugin,
		obsidianService: ObsidianService,
		stacks: DockerStackFile[],
		onSubmit: (selectedStacks: DockerStackFile[]) => void,
	) {
		super(app);
		this.stacks = stacks;
		this.selectedStacks = new Set(stacks.map((stack) => stack.name));
		this.onSubmit = onSubmit;
		this.plugin = plugin;
		this.obsidianService = obsidianService;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Select Docker Stacks to Create" });

		contentEl.createEl("p", {
			text: `Found ${this.stacks.length} Docker stack${this.stacks.length === 1 ? "" : "s"} without corresponding notes. Select which ones you'd like to create:`,
		});

		// Add select all/none buttons
		const buttonContainer = contentEl.createDiv("stack-selection-buttons");
		buttonContainer.style.marginBottom = "1rem";

		const selectAllBtn = buttonContainer.createEl("button", {
			text: "Select All",
			cls: "mod-cta",
		});
		selectAllBtn.style.marginRight = "0.5rem";
		selectAllBtn.onclick = () => {
			this.selectedStacks = new Set(this.stacks.map((stack) => stack.name));
			this.refreshCheckboxes();
		};

		const selectNoneBtn = buttonContainer.createEl("button", {
			text: "Select None",
		});
		selectNoneBtn.onclick = () => {
			this.selectedStacks.clear();
			this.refreshCheckboxes();
		};

		// Create checkboxes for each stack
		const stackContainer = contentEl.createDiv("stack-selection-list");
		stackContainer.style.maxHeight = "300px";
		stackContainer.style.overflowY = "auto";
		stackContainer.style.border = "1px solid var(--background-modifier-border)";
		stackContainer.style.padding = "0.5rem";
		stackContainer.style.marginBottom = "1rem";

		for (const stack of this.stacks.sort((a, b) =>
			a.name.localeCompare(b.name),
		)) {
			const stackItem = stackContainer.createDiv("stack-item");
			stackItem.style.padding = "0.25rem 0";
			stackItem.style.display = "flex";
			stackItem.style.alignItems = "center";

			const checkbox = stackItem.createEl("input", {
				type: "checkbox",
			});
			checkbox.checked = this.selectedStacks.has(stack.name);
			checkbox.style.marginRight = "0.5rem";

			const label = stackItem.createEl("label");
			label.style.cursor = "pointer";

			// Create stack name and preview filename
			stackItem.createEl("strong", { text: stack.name });

			const previewName = this.obsidianService.generateFileName(stack.name);
			const preview = stackItem.createEl("div");
			preview.style.fontSize = "0.8em";
			preview.style.color = "var(--text-muted)";
			preview.style.fontStyle = "italic";
			preview.style.marginLeft = "0.5rem";
			preview.textContent = `→ ${previewName}`;

			// Handle checkbox changes
			const toggleSelection = () => {
				if (this.selectedStacks.has(stack.name)) {
					this.selectedStacks.delete(stack.name);
				} else {
					this.selectedStacks.add(stack.name);
				}
				checkbox.checked = this.selectedStacks.has(stack.name);
			};

			checkbox.addEventListener("change", toggleSelection);
			label.addEventListener("click", toggleSelection);
		}

		// Add action buttons
		const actionContainer = contentEl.createDiv("stack-selection-actions");
		actionContainer.style.display = "flex";
		actionContainer.style.justifyContent = "flex-end";
		actionContainer.style.gap = "0.5rem";

		const cancelBtn = actionContainer.createEl("button", {
			text: "Cancel",
		});
		cancelBtn.onclick = () => this.close();

		const createBtn = actionContainer.createEl("button", {
			text: "Create Selected",
			cls: "mod-cta",
		});
		createBtn.onclick = () => {
			const selectedStackObjects = this.stacks.filter((stack) =>
				this.selectedStacks.has(stack.name),
			);
			this.onSubmit(selectedStackObjects);
			this.close();
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private refreshCheckboxes() {
		const checkboxes = this.contentEl.querySelectorAll(
			'input[type="checkbox"]',
		) as NodeListOf<HTMLInputElement>;
		checkboxes.forEach((checkbox, index) => {
			checkbox.checked = this.selectedStacks.has(this.stacks[index].name);
		});
	}

	/**
	 * Generates a preview of what the filename will look like based on current settings.
	 * This is a simplified version of the actual generateFileName method in ObsidianService.
	 */
	private generatePreviewFileName(stackName: string): string {
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
	 * Capitalizes the stack name for use as a file name.
	 */
	private capitalizeStackName(stackName: string): string {
		return stackName
			.split(/[-_\s]+/)
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(" ");
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
}
