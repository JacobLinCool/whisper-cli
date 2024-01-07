import { Command } from "commander";
import { model } from "./model";
import { server } from "./server";
import { transcribe } from "./transcribe";

export const smart = new Command("smart")
	.description("Smart Whisper commands")
	.addCommand(transcribe)
	.addCommand(model)
	.addCommand(server);
