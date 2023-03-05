import fs from "node:fs";
import { config } from "dotenv";
import { Configuration, OpenAIApi } from "openai";

config();

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
	throw new Error("OpenAI API key (env.OPENAI_API_KEY) not found");
}

export async function recognize(
	audio_file: string,
	{ model = "whisper-1", prompt = undefined as string | undefined } = {},
): Promise<string> {
	const config = new Configuration({ apiKey: KEY });
	const openai = new OpenAIApi(config);

	const file = fs.createReadStream(audio_file);

	const trans = await openai.createTranscription(file, model, prompt);
	return trans.data.text;
}
