// adapted from https://github.com/ashishbajaj99/mic (MIT License)
import { spawn } from "node:child_process";
import { type } from "node:os";
import type { TransformCallback } from "node:stream";
import { PassThrough, Transform } from "node:stream";

const isMac = type() == "Darwin";
const isWindows = type().indexOf("Windows") > -1;

class IsSilence extends Transform {
	public options = { debug: false };
	protected consecSilenceCount = 0;
	protected numSilenceFramesExitThresh = 0;
	protected silenceThresh = 2000;

	constructor(options?: { debug: boolean }) {
		super();
		this.options.debug = options?.debug || false;
	}

	public getNumSilenceFramesExitThresh() {
		return this.numSilenceFramesExitThresh;
	}

	public getConsecSilenceCount() {
		return this.consecSilenceCount;
	}

	public setNumSilenceFramesExitThresh(numFrames: number) {
		this.numSilenceFramesExitThresh = numFrames;
		return;
	}

	public setSilenceThresh(silenceThresh: number) {
		this.silenceThresh = silenceThresh;
		return;
	}

	public incrConsecSilenceCount() {
		this.consecSilenceCount++;
		return this.consecSilenceCount;
	}

	public resetConsecSilenceCount() {
		this.consecSilenceCount = 0;
		return;
	}

	public _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback) {
		const debug = this.options.debug;
		const numSilenceFramesExitThresh = this.getNumSilenceFramesExitThresh();

		let i;
		let speechSample;
		let silenceLength = 0;
		let consecutiveSilence = this.getConsecSilenceCount();

		if (numSilenceFramesExitThresh) {
			for (i = 0; i < chunk.length; i = i + 2) {
				if (chunk[i + 1] > 128) {
					speechSample = (chunk[i + 1] - 256) * 256;
				} else {
					speechSample = chunk[i + 1] * 256;
				}
				speechSample += chunk[i];

				if (Math.abs(speechSample) > this.silenceThresh) {
					if (debug) {
						console.log("Found speech block");
					}
					//emit 'sound' if we hear a sound after a silence
					if (consecutiveSilence >= numSilenceFramesExitThresh) {
						this.emit("sound");
					}
					this.resetConsecSilenceCount();
					break;
				} else {
					silenceLength++;
				}
			}
			if (silenceLength == chunk.length / 2) {
				consecutiveSilence = this.incrConsecSilenceCount();
				if (debug) {
					console.log(
						"Found silence block: %d of %d",
						consecutiveSilence,
						numSilenceFramesExitThresh,
					);
				}
				//emit 'silence' only once each time the threshold condition is met
				if (consecutiveSilence === numSilenceFramesExitThresh) {
					this.emit("silence");
				}
			}
		}
		this.push(chunk);
		callback();
	}
}

export default function mic(options: {
	endian?: string;
	bitwidth?: string;
	encoding?: string;
	rate?: string;
	channels?: string;
	device?: string;
	exitOnSilence?: number;
	silenceThresh?: number;
	fileType?: string;
	debug?: boolean;
}) {
	options = options || {};
	const that: any = {};
	const endian = options.endian || "little";
	const bitwidth = options.bitwidth || "16";
	const encoding = options.encoding || "signed-integer";
	const rate = options.rate || "16000";
	const channels = options.channels || "1";
	const device = options.device || "plughw:1,0";
	const exitOnSilence = Number(options.exitOnSilence) || 0;
	const silenceThresh = Number(options.silenceThresh) || 2000;
	const fileType = options.fileType || "raw";
	const debug = options.debug || false;
	let format: any, formatEndian, formatEncoding;
	let audioProcess: any = null;
	const infoStream = new PassThrough();
	const audioStream = new IsSilence({ debug });
	const audioProcessOptions: any = {
		stdio: ["ignore", "pipe", "ignore"],
	};

	if (debug) {
		audioProcessOptions.stdio[2] = "pipe";
	}

	// Setup format variable for arecord call
	if (endian === "big") {
		formatEndian = "BE";
	} else {
		formatEndian = "LE";
	}
	if (encoding === "unsigned-integer") {
		formatEncoding = "U";
	} else {
		formatEncoding = "S";
	}
	format = formatEncoding + bitwidth + "_" + formatEndian;
	audioStream.setNumSilenceFramesExitThresh(Math.round(exitOnSilence));
	audioStream.setSilenceThresh(Math.round(silenceThresh));

	that.start = function start() {
		if (audioProcess === null) {
			if (isWindows) {
				audioProcess = spawn(
					"sox",
					[
						"-b",
						bitwidth,
						"--endian",
						endian,
						"-c",
						channels,
						"-r",
						rate,
						"-e",
						encoding,
						"-t",
						"waveaudio",
						"default",
						"-p",
					],
					audioProcessOptions,
				);
			} else if (isMac) {
				audioProcess = spawn(
					"rec",
					[
						"-b",
						bitwidth,
						"--endian",
						endian,
						"-c",
						channels,
						"-r",
						rate,
						"-e",
						encoding,
						"-t",
						fileType,
						"-",
					],
					audioProcessOptions,
				);
			} else {
				audioProcess = spawn(
					"arecord",
					["-t", fileType, "-c", channels, "-r", rate, "-f", format, "-D", device],
					audioProcessOptions,
				);
			}

			audioProcess.on("exit", function (code: any, sig: any) {
				if (code != null && sig === null) {
					audioStream.emit("audioProcessExitComplete");
					if (debug)
						console.log("recording audioProcess has exited with code = %d", code);
				}
			});
			audioProcess.stdout.pipe(audioStream);
			if (debug) {
				audioProcess.stderr.pipe(infoStream);
			}
			audioStream.emit("startComplete");
		} else {
			if (debug) {
				throw new Error("Duplicate calls to start(): Microphone already started!");
			}
		}
	};

	that.stop = function stop() {
		if (audioProcess != null) {
			audioProcess.kill("SIGTERM");
			audioProcess = null;
			audioStream.emit("stopComplete");
			if (debug) console.log("Microphone stopped");
		}
	};

	that.pause = function pause() {
		if (audioProcess != null) {
			audioProcess.kill("SIGSTOP");
			audioStream.pause();
			audioStream.emit("pauseComplete");
			if (debug) console.log("Microphone paused");
		}
	};

	that.resume = function resume() {
		if (audioProcess != null) {
			audioProcess.kill("SIGCONT");
			audioStream.resume();
			audioStream.emit("resumeComplete");
			if (debug) console.log("Microphone resumed");
		}
	};

	that.getAudioStream = function getAudioStream() {
		return audioStream;
	};

	if (debug) {
		infoStream.on("data", function (data) {
			console.log("Received Info: " + data);
		});
		infoStream.on("error", function (error) {
			console.log("Error in Info Stream: " + error);
		});
	}

	return that;
}
