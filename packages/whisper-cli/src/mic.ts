// adapted from https://github.com/ashishbajaj99/mic (MIT License)
import { spawn } from "node:child_process";
import { type } from "node:os";
import { PassThrough, Transform } from "node:stream";
import util from "node:util";

const isMac = type() == "Darwin";
const isWindows = type().indexOf("Windows") > -1;

function IsSilence(options: any) {
	// @ts-expect-error
	var that = this;
	if (options && options.debug) {
		that.debug = options.debug;
		delete options.debug;
	}
	Transform.call(that, options);
	var consecSilenceCount = 0;
	var numSilenceFramesExitThresh = 0;

	that.getNumSilenceFramesExitThresh = function getNumSilenceFramesExitThresh() {
		return numSilenceFramesExitThresh;
	};

	that.getConsecSilenceCount = function getConsecSilenceCount() {
		return consecSilenceCount;
	};

	that.setNumSilenceFramesExitThresh = function setNumSilenceFramesExitThresh(numFrames: number) {
		numSilenceFramesExitThresh = numFrames;
		return;
	};

	that.incrConsecSilenceCount = function incrConsecSilenceCount() {
		consecSilenceCount++;
		return consecSilenceCount;
	};

	that.resetConsecSilenceCount = function resetConsecSilenceCount() {
		consecSilenceCount = 0;
		return;
	};
}
util.inherits(IsSilence, Transform);

IsSilence.prototype._transform = function (chunk: any, encoding: any, callback: any) {
	var i;
	var speechSample;
	var silenceLength = 0;
	var self = this;
	var debug = self.debug;
	var consecutiveSilence = self.getConsecSilenceCount();
	var numSilenceFramesExitThresh = self.getNumSilenceFramesExitThresh();
	var incrementConsecSilence = self.incrConsecSilenceCount;
	var resetConsecSilence = self.resetConsecSilenceCount;

	if (numSilenceFramesExitThresh) {
		for (i = 0; i < chunk.length; i = i + 2) {
			if (chunk[i + 1] > 128) {
				speechSample = (chunk[i + 1] - 256) * 256;
			} else {
				speechSample = chunk[i + 1] * 256;
			}
			speechSample += chunk[i];

			if (Math.abs(speechSample) > 2000) {
				if (debug) {
					console.log("Found speech block");
				}
				//emit 'sound' if we hear a sound after a silence
				if (consecutiveSilence >= numSilenceFramesExitThresh) self.emit("sound");
				resetConsecSilence();
				break;
			} else {
				silenceLength++;
			}
		}
		if (silenceLength == chunk.length / 2) {
			consecutiveSilence = incrementConsecSilence();
			if (debug) {
				console.log(
					"Found silence block: %d of %d",
					consecutiveSilence,
					numSilenceFramesExitThresh,
				);
			}
			//emit 'silence' only once each time the threshold condition is met
			if (consecutiveSilence === numSilenceFramesExitThresh) {
				self.emit("silence");
			}
		}
	}
	this.push(chunk);
	callback();
};

export default function mic(options: any) {
	options = options || {};
	var that: any = {};
	var endian = options.endian || "little";
	var bitwidth = options.bitwidth || "16";
	var encoding = options.encoding || "signed-integer";
	var rate = options.rate || "16000";
	var channels = options.channels || "1";
	var device = options.device || "plughw:1,0";
	var exitOnSilence = options.exitOnSilence || 0;
	var fileType = options.fileType || "raw";
	var debug = options.debug || false;
	var format: any, formatEndian, formatEncoding;
	var audioProcess: any = null;
	var infoStream = new PassThrough();
	// @ts-expect-error
	var audioStream = new IsSilence({ debug: debug });
	var audioProcessOptions: any = {
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
	audioStream.setNumSilenceFramesExitThresh(parseInt(exitOnSilence, 10));

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
