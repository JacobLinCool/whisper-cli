#!/usr/bin/env node
import chalk from "chalk";
import { program } from "commander";
import fs from "node:fs";
import ora from "ora";
import { convert } from "./convert";
import mic_test from "./mic-test";
import { Microphone } from "./microphone";
import { pkg } from "./pkg";
import { recognize } from "./recognize";
import { smart } from "./smart";

program.name("whisper").description(pkg.description).version(pkg.version);

program
	.command("recognize <audio>")
	.alias("rec")
	.description("Recognize text from an audio file")
	.option("-c, --convert", "Convert source audio to mp3 file first")
	.option("-o, --output <file>", "Output file")
	.option("-p, --prompt <prompt>", "Prompt for hints")
	.option("-m, --model <model>", "Model to use", "whisper-1")
	.action(
		async (
			audio: string,
			opts: {
				convert?: boolean;
				output?: string;
				prompt?: string;
				model?: string;
			},
		) => {
			if (!fs.existsSync(audio)) {
				console.error(chalk.red(`Audio file ${audio} not found`));
				process.exit(1);
			}

			if (opts.convert) {
				const spinner = ora(`Converting ${audio} ...`).start();
				audio = convert(audio);
				spinner?.succeed(`Successfully converted ${audio}`);
			}

			try {
				const spinner = ora(`Recognizing ${audio} ...`).start();
				const result = await recognize(audio, { prompt: opts.prompt, model: opts.model });
				spinner?.succeed(`Recognized ${audio}`);

				if (opts.output) {
					fs.writeFileSync(opts.output, result);
				} else {
					console.log(result);
				}
			} catch (err) {
				console.error(chalk.red(err));
				process.exit(1);
			}
		},
	);

program
	.command("microphone")
	.alias("mic")
	.description("Recognize text from microphone")
	.option("-o, --output <file>", "Output file")
	.option("-p, --prompt <prompt>", "Prompt for hints")
	.option("-m, --model <model>", "Model to use", "whisper-1")
	.option("-s, --silence <frames>", "Silence duration in frames", Number, 2)
	.option("-t, --threshold <strengh>", "Silence threshold", Number, 2400)
	.action(
		async (opts: {
			output?: string;
			prompt?: string;
			model?: string;
			silence: number;
			threshold: number;
		}) => {
			const mic = new Microphone({
				model: opts.model,
				prompt: opts.prompt,
				silence: opts.silence,
				output: opts.output,
				threshold: opts.threshold,
			});
			mic.start();

			process.on("SIGINT", () => {
				mic.stop();
				process.exit(0);
			});

			process.on("SIGTERM", () => {
				mic.stop();
				process.exit(0);
			});
		},
	);

program
	.command("mic-test")
	.description("Test microphone")
	.option("-s, --silence <frames>", "Silence duration in frames", Number, 2)
	.option("-t, --threshold <strengh>", "Silence threshold", Number, 2400)
	.action(async (opts: { silence: number; threshold: number }) => {
		mic_test(opts.silence, opts.threshold);
	});

program.addCommand(smart);

program.parse(process.argv);
