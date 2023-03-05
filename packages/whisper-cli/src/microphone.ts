import EventEmitter from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Transform } from "node:stream";
import { config } from "dotenv";
import { Configuration, OpenAIApi } from "openai";
import ora, { Ora } from "ora";
import { FileWriter } from "wav";
import mic from "./mic";

config();

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
	throw new Error("OpenAI API key (env.OPENAI_API_KEY) not found");
}

export class Microphone extends EventEmitter {
	private mic?: any;
	private spinner?: Ora;
	private model: string;
	private prompt?: string;
	private output?: string;
	private silence: number;

	constructor({
		model = "whisper-1",
		prompt = undefined as string | undefined,
		output = undefined as string | undefined,
		silence = 4,
	} = {}) {
		super();
		this.model = model;
		this.prompt = prompt;
		this.output = output;
		this.silence = silence;
	}

	start(): void {
		const spinner = ora("Initializing").start();
		this.spinner = spinner;

		this.mic = mic({ exitOnSilence: this.silence });
		const stream: Transform = this.mic.getAudioStream();

		const config = new Configuration({ apiKey: KEY });
		const openai = new OpenAIApi(config);

		const dir = path.resolve(os.tmpdir(), "whisper-cli");
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		const out = this.output ? fs.createWriteStream(this.output) : undefined;

		let listening = true;

		let writer_name = `${Date.now()}.wav`;
		let writer = new FileWriter(path.resolve(dir, writer_name), {
			sampleRate: 16000,
			channels: 1,
		});

		stream.on("data", async (data: Buffer) => {
			if (listening) {
				if (!spinner.isSpinning) {
					spinner.start();
				}
				spinner.text = "Listening ...";
				writer.write(data);
			}
		});

		stream.on("error", async (err) => {
			spinner.fail(`Mic Error: ${err}`);
		});

		stream.on("silence", async () => {
			listening = false;
			spinner.text = "Recognizing ...";

			const reader_name = writer_name;
			writer_name = `${Date.now()}.wav`;
			writer.end(() => {
				setTimeout(async () => {
					const size = fs.statSync(path.resolve(dir, reader_name)).size;
					if (size < 1000) {
						return;
					}

					const reader = fs.createReadStream(path.resolve(dir, reader_name));
					try {
						const trans = await openai.createTranscription(
							reader,
							this.model,
							this.prompt,
						);
						const result = trans.data.text.trim();
						if (result) {
							spinner.info(result);
							out?.write(`${result}\n`);
						}
					} catch (err) {
						spinner.fail("Error");
						console.error(err, reader_name);
						// @ts-expect-error
						console.error(err.response.data);
						process.exit(1);
					}
				}, 100);
			});
			writer = new FileWriter(path.resolve(dir, writer_name), {
				sampleRate: 16000,
				channels: 1,
			});
		});

		stream.on("sound", async () => {
			listening = true;
		});

		this.mic.start();
	}

	stop(): void {
		this.spinner?.stop();
		this.mic?.stop();
	}
}
