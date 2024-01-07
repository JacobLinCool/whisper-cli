import { Command } from "commander";
import { decode } from "node-wav";
import fs from "node:fs";
import { Whisper, manager } from "smart-whisper";
import { convert } from "./convert";

export const transcribe = new Command("transcribe")
	.arguments("<source>")
	.description("Transcribe audio")
	.option("-o, --output <file>", "Output file")
	.option("-p, --prompt <prompt>", "Prompt")
	.option("-t, --temperature <temperature>", "Temperature", (val) => parseFloat(val), 0)
	.option("-g, --gpu", "Use GPU", false)
	.option("-l, --language <language>", "Language", "auto")
	.option("-m, --model <model>", "Model to use", "base")
	.action(
		async (
			source: string,
			opt: {
				output?: string;
				prompt?: string;
				model?: string;
				temperature?: number;
				gpu?: boolean;
				language?: string;
			},
		) => {
			opt.model = opt.model || "base";
			opt.language = opt.language || "auto";
			const model = manager.check(opt.model) ? manager.resolve(opt.model) : opt.model;
			const whisper = new Whisper(model, { gpu: opt.gpu });

			const wav = convert(source);
			const { channelData } = decode(fs.readFileSync(wav));
			fs.unlinkSync(wav);

			const { result } = await whisper.transcribe(channelData[0], {
				initial_prompt: opt.prompt,
				temperature: opt.temperature,
				language: opt.language,
			});

			const results = await result;
			await whisper.free();

			const json = JSON.stringify(results, null, 2);
			console.log(json);

			if (opt.output) {
				fs.writeFileSync(opt.output, json);
			}
		},
	);
