import { Command } from "commander";
import { decode } from "node-wav";
import fs from "node:fs";
import { Whisper, manager } from "smart-whisper";
import { convert } from "./convert";

export const transcribe = new Command("transcribe")
	.arguments("<source>")
	.description("Transcribe audio")
	.option("-o, --output <file>", "Output file")
	.option("-m, --model <model>", "Model to use", "base")
	.option("-p, --prompt <prompt>", "Prompt")
	.option("-t, --temperature <temperature>", "Temperature", (val) => parseFloat(val), 0)
	.option("-g, --gpu", "Use GPU", false)
	.option("-n, --n-thread <n_thread>", "Number of threads to use", (val) => parseInt(val), 4)
	.option("-l, --language <language>", "Language", "auto")
	.option("--suppress-blank", "Suppress blank", true)
	.option("--suppress-non-speech-tokens", "Suppress non speech tokens", false)
	.action(
		async (
			source: string,
			opt: {
				output?: string;
				prompt?: string;
				model?: string;
				temperature?: number;
				gpu?: boolean;
				nThread?: number;
				language?: string;
				suppressBlank?: boolean;
				suppressNonSpeechTokens?: boolean;
			},
		) => {
			opt.model = opt.model || "base";
			opt.language = opt.language || "auto";
			opt.suppressBlank = opt.suppressBlank || true;
			opt.suppressNonSpeechTokens = opt.suppressNonSpeechTokens || false;
			const model = manager.check(opt.model) ? manager.resolve(opt.model) : opt.model;
			const whisper = new Whisper(model, { gpu: opt.gpu });

			const wav = convert(source);
			const { channelData } = decode(fs.readFileSync(wav));
			fs.unlinkSync(wav);

			const options = {
				initial_prompt: opt.prompt,
				temperature: opt.temperature,
				language: opt.language,
				n_threads: opt.nThread,
				suppress_blank: opt.suppressBlank,
				suppress_non_speech_tokens: opt.suppressNonSpeechTokens,
			};
			console.log(options);

			const { result } = await whisper.transcribe(channelData[0], options);

			const results = await result;
			await whisper.free();

			const json = JSON.stringify(results, null, 2);
			console.log(json);

			if (opt.output) {
				fs.writeFileSync(opt.output, json);
			}
		},
	);
