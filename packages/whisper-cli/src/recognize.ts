import { config } from "dotenv";
import fs from "node:fs";
import { OpenAI } from "openai";

config();

export async function recognize(
	audio_file: string,
	{ model = "whisper-1", prompt = undefined as string | undefined } = {},
): Promise<string> {
	const KEY = process.env.OPENAI_API_KEY;
	if (!KEY) {
		throw new Error("OpenAI API key (env.OPENAI_API_KEY) not found");
	}

	const openai = new OpenAI({ apiKey: KEY });

	const file = fs.createReadStream(audio_file);

	const trans = await openai.audio.transcriptions.create({ file, model, prompt });
	return trans.text;
}
