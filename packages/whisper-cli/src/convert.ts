import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

/**
 * Convert to mp3
 * @param source Path to the wav file
 * @param ffmpeg Path to the ffmpeg executable
 */
export function convert(source: string, ffmpeg = "ffmpeg"): string {
	const temp = path.resolve(os.tmpdir(), `converted_${path.basename(source)}.mp3`);

	const args = [
		"-loglevel",
		"error",
		"-i",
		path.basename(source),
		"-acodec",
		"libmp3lame",
		"-ac",
		"1",
		"-ar",
		"16000",
		temp,
	];

	spawnSync(ffmpeg, args, { cwd: path.dirname(source), stdio: "ignore" });

	return temp;
}
