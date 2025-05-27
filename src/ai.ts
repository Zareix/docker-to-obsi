import { generateObject, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { DockerStackFile } from "src/github";
import type DockerToObsiPlugin from "src/main";
import { z } from "zod";

export default class AIService {
	private readonly plugin: DockerToObsiPlugin;

	constructor(plugin: DockerToObsiPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Generates a description for a Docker stack based on its compose file content.
	 */
	async generateStackDescription(stack: DockerStackFile): Promise<string> {
		try {
			const apiKey = this.plugin.settings.openaiApiKey?.trim();
			if (!apiKey) {
				console.warn(
					"OpenAI API key not configured, using placeholder description",
				);
				return "Write description here";
			}

			const client = createOpenAI({ apiKey });

			const { text } = await generateText({
				model: client("gpt-4.1-mini"),
				messages: [
					{
						role: "system",
						content:
							"You are a technical documentation expert, you're used to Homelab infrastructure and you are a Developer. You'll will have to give a pragmatic, objective, short description of a tool or application used in a Homelab based on the name given to you. Keep descriptions between 20-50 words.",
					},
					{
						role: "user",
						content: `Give a short description of "${stack.name}"`,
					},
				],
				temperature: 0.3,
				maxTokens: 200,
			});

			return text.trim();
		} catch (error) {
			console.error(
				`Failed to generate AI description for stack ${stack.name}:`,
				error,
			);
			return "Write description here";
		}
	}

	/**
	 * Generates tags for a Docker stack based on its compose file content.
	 */
	async generateStackTags(stack: DockerStackFile): Promise<string[]> {
		try {
			const apiKey = this.plugin.settings.openaiApiKey?.trim();
			if (!apiKey) {
				console.warn("OpenAI API key not configured, using default tags");
				return [];
			}

			const client = createOpenAI({ apiKey });

			const { object } = await generateObject({
				model: client("gpt-4.1-mini"),
				schema: z.object({
					tags: z.array(z.string().min(1).max(20)).min(1).max(3),
				}),
				messages: [
					{
						role: "system",
						content:
							"You are a technical documentation expert, you're used to Homelab infrastructure and you are a Developer. You'll be given a name of an application or a tool used in a Homelab, based on it you will have to suggest relevant tags. Keep tags short, single word, give only tags list and nothing else in one line and separate each by a coma. A tag is between 1-20 characters, use lowercase letters only. Given 1 to 3 tags.",
					},
					{
						role: "user",
						content: `Suggest tags for "${stack.name}"`,
					},
				],
				temperature: 0.3,
				maxTokens: 100,
			});

			return object.tags;
		} catch (error) {
			console.error(
				`Failed to generate AI tags for stack ${stack.name}:`,
				error,
			);
			return [];
		}
	}
}
