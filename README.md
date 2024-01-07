# Whisper CLI

A CLI speech recognition tool, using OpenAI Whisper, supports audio file transcription and near-realtime microphone input.

It supports running [Smart Whisper](https://github.com/JacobLinCool/smart-whisper) locally with `whisper smart` subcommand.

```sh
❯ whisper help
Usage: whisper [options] [command]

A CLI speech recognition tool, using OpenAI Whisper, supports audio file transcription and near-realtime microphone input.

Options:
  -V, --version                            output the version number
  -h, --help                               display help for command

Commands:
  recognize|rec [options] <audio>          Recognize text from an audio file
  microphone|mic [options]                 Recognize text from microphone
  help [command]                           display help for command
```

## Installation

```sh
npm install -g whisper-cli
```

## Usage

You need to set the `OPENAI_API_KEY` environment variable first.

> You can also put it in a `.env` file in the current directory.

```sh
whisper help
```

### Smart Whisper

[Smart Whisper](https://github.com/JacobLinCool/smart-whisper) allows you to run whisper locally with native performance.

```sh
whisper smart help # show help
whisper smart model download base # download base model
whisper smart transcribe <audio> --gpu --model base # transcribe audio file with base model on GPU
whisper smart server --gpu --port 3000 --model large-v3 # run server on port 3000 with large-v3 model on GPU
```

`whisper smart server` runs a transcribe server, which manages the model memory automatically, it will offload the model when idling, and load it back when needed.

The OpenAPI spec is available at `http://localhost:<port>/openapi.json`. You can use API-Spec to browse it: <https://api-spec.pages.dev/rapidoc?url=http%3A%2F%2Flocalhost%3A3000%2Fopenapi.json>
