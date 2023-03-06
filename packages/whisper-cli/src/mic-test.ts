import type { Transform } from "node:stream";
import ora from "ora";
import mic from "./mic";

export default function (silence: number, threshold: number) {
	const source = mic({ exitOnSilence: silence, silenceThresh: threshold });
	const stream: Transform = source.getAudioStream();

	const spinner = ora("Initializing").start();

	let listening = true;
	let frames = 0;

	stream.on("data", async () => {
		frames++;
		if (listening) {
			if (!spinner.isSpinning) {
				spinner.start();
			}
			spinner.text = `Listening (${frames}) ...`;
		}
	});

	stream.on("error", async (err) => {
		spinner.fail(`Mic Error: ${err}`);
	});

	stream.on("silence", async () => {
		listening = false;
		spinner.info(`Silence (after ${frames} hearable frames)`);
		frames = 0;
	});

	stream.on("sound", async () => {
		listening = true;
		spinner.info(`Sound (after ${frames} silent frames)`);
		frames = 0;
	});

	source.start();
}
