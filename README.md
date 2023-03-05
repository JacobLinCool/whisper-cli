# Whisper CLI

A CLI speech recognition tool, using OpenAI Whisper, supports audio file transcription and near-realtime microphone input.

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
