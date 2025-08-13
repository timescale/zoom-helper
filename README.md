# zoom-helper

AI bot for zoom that provides real-time transcription and assistance to sales people
at TigerData.

## Getting Started

```bash
npm install
```

You will then need to configure the `.env` file, starting with `.env.sample`.
You will need API keys from:

* [recall.ai](https://www.recall.ai/)
* [Anthropic](https://www.anthropic.com/)
* [OpenAI](https://openai.com/)

We use recall.ai to handle the transcription, and so you will also need to make the app
publicly available so that recall.ai can send payloads via Webhook. You can use
[ngrok](https://ngrok.com/) to accomplish this. Once you have your public URL, you will
need to go to the Webhooks dashboard in recall.ai and add it there and configure it to
receive the following payloads:

* `bot.in_call_recording`
* `bot.call_ended`
* `bot.done`

## Running the app

To run the app regularly, do:

```bash
npm run start
```

When in development and want hot-reloading, you can use:

```bash
npm run dev
```

## Usage

When the app is running, the main page is a dashboard where you can invite the bot to
zoom meetings as well as see prior meetings that the bot was invited to. When inviting
a bot to a meeting, you can then select three real-time capabilities, in addition to
the real-time transcription:

1. Provide definitions of technical terms. Terms will be highlighted in the transcript,
  and you can mouse over them to view the definition.
2. Provide answers to questions. For any line that is determined to be a question, it
  will append a `*` that on mousing over will show the answer.
3. Provide sales analysis over the transcript. This will try to categorize/summarize
  the incoming transcript into four different categories:
    * Current State - What is the of a customer's current database setup
    * Business Outcomes - What is the hoped for outcomes in switching databases or
      providers.
    * Solution Requirements - What are the requirements any replacment must have
      or be able to do.
    * Metrics - How would the company measure the success of switching.

All of the data is saved in a database, and is viewable for any historical meeting.
