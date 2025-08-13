import { config } from 'dotenv';
import path, { dirname } from 'node:path';
import readline from 'node:readline';
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

async function sendBotJoiningCall(): Promise<void> {
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

async function sendTranscriptData(message: string): Promise<void> {
  const payload: TranscriptDataPayload = {
    event: 'transcript.data',
    data: {
      data: {
        words: [
          {
            text: message,
            start_timestamp: { relative: 0 },
            end_timestamp: { relative: 10 },
          },
        ],
        participant: {
          id: 12345,
          name: 'Test User',
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

async function main(): Promise<void> {
  console.log('🤖 Starting message script...');
  console.log(`Bot ID: ${BOT_ID}`);

  // Send bot joining call on startup
  await sendBotJoiningCall();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(
    '\n📝 Type messages to send as transcript data (Ctrl+C to exit):',
  );

  rl.on('line', async (input: string) => {
    const message = input.trim();
    if (message) {
      await sendTranscriptData(message);
    }
  });

  // Handle Ctrl+C
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    rl.close();
    await sendBotDone();
    console.log('✓ Sent bot.done');
    process.exit(0);
  });

  // Handle unexpected exits
  process.on('exit', async () => {
    await sendBotDone();
  });
}

main().catch(console.error);
