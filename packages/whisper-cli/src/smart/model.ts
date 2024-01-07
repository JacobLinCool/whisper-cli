import chalk from "chalk";
import { Command } from "commander";
import fs from "node:fs";
import { manager } from "smart-whisper";

export const model = new Command("model").description("model management");

model
	.command("list")
	.alias("ls")
	.description("list models")
	.action(() => {
		console.group("Locally available models");
		for (const name of manager.list()) {
			const resolved = manager.resolve(name);
			const size = fs.statSync(resolved).size / (1 << 20);
			console.log(
				chalk.green(name.padEnd(12)),
				chalk.gray(`${size.toFixed(2).padStart(8)} MB, at ${resolved}`),
			);
		}
		console.groupEnd();
	});

model
	.command("download")
	.alias("dl")
	.description("download model")
	.argument("<model>", `${Object.keys(manager.MODELS).join(", ")}, or an url`)
	.action(async (model: string) => {
		const name = await manager.download(model);
		const resolved = manager.resolve(name);
		console.log(`Downloaded as "${chalk.yellow(name)}" (at ${resolved})`);
	});

model
	.command("remove")
	.alias("rm")
	.description("remove model")
	.argument("<model>", `The model name`)
	.action((model: string) => {
		manager.remove(model);
		console.log(`Removed "${chalk.yellow(model)}"`);
	});
