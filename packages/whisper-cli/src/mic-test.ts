import type { Transform } from "node:stream";
import ora from "ora";
import mic from "./mic";

export default function (silence: number) {
	const source = mic({ exitOnSilence: silence });
	const stream: Transform = source.getAudioStream();

	const spinner = ora("Initializing").start();

	let listening = true;

	stream.on("data", async () => {
		if (listening) {
			if (!spinner.isSpinning) {
				spinner.start();
			}
			spinner.text = "Listening ...";
		}
	});

	stream.on("error", async (err) => {
		spinner.fail(`Mic Error: ${err}`);
	});

	stream.on("silence", async () => {
		listening = false;
		spinner.info("Silence");
	});

	stream.on("sound", async () => {
		listening = true;
		spinner.info("Sound");
	});

	source.start();
}
