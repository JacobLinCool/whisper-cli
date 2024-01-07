import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Convert to wav
 */
export function convert(source: string, ffmpeg = "ffmpeg"): string {
	const dir = path.dirname(source);
	const temp = path.resolve(dir, `converted_${path.basename(source)}.wav`);

	const args = [
		"-loglevel",
		"error",
		"-i",
		path.basename(source),
		"-ac",
		"1",
		"-ar",
		"16000",
		temp,
	];

	spawnSync(ffmpeg, args, { cwd: dir, stdio: "inherit" });

	return temp;
}
