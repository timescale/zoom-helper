import { config } from 'dotenv';
import fs from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: path.join(__dirname, '..', '.env') });

console.log(`APP_URL: ${process.env.APP_URL}`);
const WEBHOOK_URL = `${process.env.APP_URL}/webhook`;
const BOT_ID = uuidv4();
const REALTIME_ENDPOINT_ID = uuidv4();
const TRANSCRIPT_ID = uuidv4();
const RECORDING_ID = uuidv4();

interface BotInCallRecording {
  event: 'bot.in_call_recording';
  data: {
    data: {
      code: string;
      sub_code: string | null;
      updated_at: string;
    };
    bot: {
      id: string;
      metadata: object;
    };
  };
}

interface BotDonePayload {
  event: 'bot.done';
  data: {
    data: {
      code: string;
      sub_code: string | null;
      updated_at: string;
    };
    bot: {
      id: string;
      metadata: object;
    };
  };
}

interface TranscriptDataPayload {
  event: 'transcript.data';
  data: {
    data: {
      words: Array<{
        text: string;
        start_timestamp: { relative: number };
        end_timestamp: { relative: number } | null;
      }>;
      participant: {
        id: number;
        name: string | null;
        is_host: boolean;
        platform: string | null;
        extra_data: object;
      };
    };
    realtime_endpoint: {
      id: string;
      metadata: object;
    };
    transcript: {
      id: string;
      metadata: object;
    };
    recording: {
      id: string;
      metadata: object;
    };
    bot: {
      id: string;
      metadata: object;
    };
  };
}

interface TranscriptLine {
  timestamp: string;
  participantId: number;
  participantName: string;
  text: string;
}

async function sendWebhook(
  payload: BotInCallRecording | BotDonePayload | TranscriptDataPayload,
): Promise<boolean> {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(
        `Webhook failed: ${response.status} ${response.statusText}`,
      );
      const text = await response.text();
      console.error('Response:', text);
      return false;
    } else {
      console.log(`✓ Sent ${payload.event}`);
      return true;
    }
  } catch (error) {
    console.error('Error sending webhook:', error);
    return false;
  }
}

async function sendBotInCallRecording(): Promise<void> {
  const payload: BotInCallRecording = {
    event: 'bot.in_call_recording',
    data: {
      data: {
        code: 'in_call_recording',
        sub_code: null,
        updated_at: new Date().toISOString(),
      },
      bot: {
        id: BOT_ID,
        metadata: {},
      },
    },
  };

  const success = await sendWebhook(payload);
  if (!success) {
    throw new Error('Failed to send bot.in_call_recording');
  }
}

async function sendBotDone(): Promise<void> {
  const payload: BotDonePayload = {
    event: 'bot.done',
    data: {
      data: {
        code: 'done',
        sub_code: null,
        updated_at: new Date().toISOString(),
      },
      bot: {
        id: BOT_ID,
        metadata: {},
      },
    },
  };

  await sendWebhook(payload);
}

function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function parseTranscriptHeader(line: string): {
  timestamp: string;
  participantId: number;
  participantName: string;
} | null {
  const match = line.match(/^(\d{2}:\d{2}:\d{2}) - \((\d+)\)([^:]+):$/);
  if (!match) {
    return null;
  }

  const [, timestamp, participantId, participantName] = match;
  return {
    timestamp,
    participantId: parseInt(participantId, 10),
    participantName: participantName.trim(),
  };
}

async function sendTranscriptData(
  transcriptLine: TranscriptLine,
): Promise<void> {
  const timestampSeconds = parseTimestamp(transcriptLine.timestamp);

  const payload: TranscriptDataPayload = {
    event: 'transcript.data',
    data: {
      data: {
        words: [
          {
            text: transcriptLine.text,
            start_timestamp: { relative: timestampSeconds },
            end_timestamp: null,
          },
        ],
        participant: {
          id: transcriptLine.participantId,
          name: transcriptLine.participantName,
          is_host: false,
          platform: 'zoom',
          extra_data: {},
        },
      },
      realtime_endpoint: {
        id: REALTIME_ENDPOINT_ID,
        metadata: {},
      },
      transcript: {
        id: TRANSCRIPT_ID,
        metadata: {},
      },
      recording: {
        id: RECORDING_ID,
        metadata: {},
      },
      bot: {
        id: BOT_ID,
        metadata: {},
      },
    },
  };

  await sendWebhook(payload);
}

async function processTranscriptFile(filePath: string): Promise<void> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();
      if (!trimmedLine) continue;

      const header = parseTranscriptHeader(trimmedLine);
      if (header && i + 1 < lines.length) {
        const text = lines[i + 1].trim();
        if (text) {
          const transcriptLine: TranscriptLine = {
            timestamp: header.timestamp,
            participantId: header.participantId,
            participantName: header.participantName,
            text: text,
          };
          await sendTranscriptData(transcriptLine);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
        i++; // Skip the next line since we just processed it
      }
    }
  } catch (error) {
    console.error('Error reading transcript file:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  const transcriptPath = process.argv[2];

  if (!transcriptPath) {
    console.error('Usage: node transcript.ts <path-to-transcript-file>');
    process.exit(1);
  }

  if (!fs.existsSync(transcriptPath)) {
    console.error(`Transcript file not found: ${transcriptPath}`);
    process.exit(1);
  }

  console.log('🤖 Starting transcript processing...');
  console.log(`Bot ID: ${BOT_ID}`);
  console.log(`Transcript file: ${transcriptPath}`);

  try {
    await sendBotInCallRecording();
  } catch (error) {
    console.error('Error sending bot.in_call_recording:', error);
    process.exit(1);
  }

  // Handle Ctrl+C
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await sendBotDone();
    console.log('✓ Sent bot.done');
    process.exit(0);
  });

  // Handle unexpected exits
  process.on('exit', async () => {
    await sendBotDone();
  });

  try {
    await processTranscriptFile(transcriptPath);
    console.log('✓ Transcript processing completed');
  } catch (error) {
    console.error('Error processing transcript:', error);
    process.exit(1);
  }
}

main().catch(console.error);
