import cors from "@fastify/cors";
import multipart, { ajvFilePlugin } from "@fastify/multipart";
import swagger from "@fastify/swagger";
import { Command } from "commander";
import fastify from "fastify";
import { decode } from "node-wav";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Whisper, manager } from "smart-whisper";
import { convert } from "./convert";

export const server = new Command("server")
	.description("run a transcribe server of Smart Whisper")
	.option("-m, --model <model>", "Model to use", "base")
	.option("-g, --gpu", "Use GPU", false)
	.option(
		"-t, --timeout <timeout>",
		"Time in seconds to wait before offloading the model if it's not being used.",
		(val) => parseInt(val),
		300,
	)
	.option("-p, --port <port>", "Port to listen on", (val) => parseInt(val), 3000)
	.action(run);

async function run(opt: { model?: string; gpu?: boolean; timeout?: number; port?: number }) {
	opt.model = opt.model || "base";
	const model = manager.check(opt.model) ? manager.resolve(opt.model) : opt.model;
	if (!fs.existsSync(model)) {
		throw new Error(`Model ${opt.model} not found`);
	}

	const whisper = new Whisper(model, { gpu: opt.gpu, offload: opt.timeout });

	const port = opt.port || 3000;

	const server = fastify({
		ajv: {
			plugins: [ajvFilePlugin],
		},
	});

	await server.register(multipart, {
		limits: {
			fileSize: 128 * (1 << 20),
			files: 1,
		},
		attachFieldsToBody: true,
		sharedSchemaId: "#shared",
	});
	await server.register(swagger, {
		openapi: {
			info: {
				title: "Smart Whisper",
				description: "Smart Whisper API",
				version: "1.0.0",
			},
			servers: [{ url: `http://localhost:${port}` }],
			tags: [{ name: "transcribe", description: "Transcribe audio" }],
			paths: {},
		},
	});
	await server.register(cors, {
		origin: true,
		methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		exposedHeaders: ["x-prepare-time-ms", "x-transcribe-time-ms"],
	});

	server.post(
		"/transcribe",
		{
			schema: {
				description: "Transcribe audio",
				tags: ["transcribe"],
				summary: "Transcribe audio",
				consumes: ["multipart/form-data"],
				produces: ["application/json"],
				body: {
					type: "object",
					required: ["audio"],
					properties: {
						audio: { isFile: true },
						prompt: {
							oneOf: [
								{ type: "string" },
								{
									type: "object",
									properties: {
										value: {
											type: "string",
										},
									},
								},
							],
						},
						temperature: {
							oneOf: [
								{ type: "string" },
								{
									type: "object",
									properties: {
										value: {
											type: "string",
										},
									},
								},
							],
						},
						language: {
							oneOf: [
								{ type: "string" },
								{
									type: "object",
									properties: {
										value: {
											type: "string",
										},
									},
								},
							],
						},
					},
				},
				response: {
					200: {
						description: "Successful response",
						type: "array",
						items: {
							type: "object",
							properties: {
								text: { type: "string" },
								from: { type: "number" },
								to: { type: "number" },
							},
						},
					},
				},
			},
		},
		async (req, reply) => {
			const dir = path.resolve(
				os.tmpdir(),
				`${Date.now()}-${Math.random().toString(36).slice(2)}`,
			);
			fs.mkdirSync(dir, { recursive: true });

			let file = "";
			const options: Record<string, string | undefined> = {};

			const body = req.body as any;
			const audio = body.audio;
			file = path.resolve(dir, audio.filename);
			const buf = await audio.toBuffer();
			fs.writeFileSync(file, buf);

			if (body.prompt?.value) {
				options.prompt = body.prompt.value;
			}
			if (body.temperature?.value) {
				options.temperature = body.temperature.value;
			}
			if (body.language?.value) {
				options.language = body.language.value;
			}

			if (!file) {
				throw new Error("No file found");
			}

			const prepare_start = Date.now();
			const wav = convert(file);
			const { channelData } = decode(fs.readFileSync(wav));
			fs.rmSync(dir, { recursive: true, force: true });
			const prepare_time = Date.now() - prepare_start;

			const transcribe_start = Date.now();
			const { result } = await whisper.transcribe(channelData[0], {
				initial_prompt: typeof options.prompt === "string" ? options.prompt : undefined,
				temperature: Number(options.temperature) || 0,
				language: options.language || "auto",
			});

			const results = await result;
			const transcribe_time = Date.now() - transcribe_start;

			reply.header("x-prepare-time-ms", prepare_time.toString());
			reply.header("x-transcribe-time-ms", transcribe_time.toString());
			reply.send(results);
		},
	);

	server.get("/openapi.json", async (_, reply) => {
		reply.send(server.swagger());
	});

	server.listen({ port }, (err, address) => {
		if (err) {
			throw err;
		}
		console.log(`Server listening on ${address}`);
		console.log(`OpenAPI spec available at ${address}/openapi.json`);
		console.log(
			`View it at https://api-spec.pages.dev/rapidoc?url=http%3A%2F%2Flocalhost%3A${port}%2Fopenapi.json`,
		);
	});

	process.on("SIGINT", async () => {
		await server.close();
		await whisper.free();
		console.log("Server closed");
		process.exit(0);
	});
}
