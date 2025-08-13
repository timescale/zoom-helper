import {
  BotCallEndedPayload,
  BotDonePayload,
  BotInCallRecordingPayload,
  RecallAi,
  TranscriptDataPayload,
} from '@masterodin/recall-ai-bot-sdk';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { Meeting, NewMeeting, Transcript, TranscriptUpdate } from './database';
import { getDefinitions, getQuestionAnswer, getSalesAnalysis } from './llm';
import {
  createMeeting,
  findMeeting,
  getMeetings,
  updateMeeting,
} from './repositories/meeting-repository';
import {
  createTranscript,
  getMeetingTranscript,
  updateTranscript,
} from './repositories/transcript-repository';
import { app, io, server } from './server';

const recallAi = new RecallAi({
  region: 'us-west-2',
});

const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  socket.on('joinRoom', (room) => {
    socket.join(room);
  });
});

const analysisPromises = new Map<string, number>();
const pendingAnalysis = new Map<string, number>();

app.get('/', async (req, res) => {
  try {
    const meetings = await getMeetings();
    res.render('index', { meetings });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).send('Error fetching meetings');
  }
});

app.get('/meeting/:id', async (req, res) => {
  const meeting = await findMeeting({ id: Number(req.params.id) });
  if (!meeting) {
    res.status(404).send('Meeting not found');
    return;
  }
  const transcripts = await getMeetingTranscript(meeting.id);

  res.render('transcript', { meeting, transcripts });
});

app.post('/create', async (req, res) => {
  try {
    const { input, functionality, bot_name } = req.body;
    console.log('Received input:', input);
    console.log('Received functionality:', functionality);

    console.log(`Webhook URL: ${process.env.APP_URL}/webhook`);

    const resp = await recallAi.createBot({
      meeting_url: input,
      bot_name: bot_name || 'Zoom Helper',
      recording_config: {
        transcript: {
          provider: {
            meeting_captions: {},
          },
        },
        realtime_endpoints: [
          {
            type: 'webhook',
            url: `${process.env.APP_URL}/webhook`,
            events: ['transcript.data'],
          },
        ],
      },
    });

    console.log('Bot response:', JSON.stringify(resp, null, 2));

    const functionalityArray = Array.isArray(functionality)
      ? functionality
      : functionality
        ? [functionality]
        : [];

    const newMeeting: NewMeeting = {
      bot_id: resp.id,
      bot_status: 'created',
      enable_definitions: functionalityArray.includes('definitions'),
      enable_question_answering:
        functionalityArray.includes('question_answering'),
      enable_sales_analysis: functionalityArray.includes('sales_analysis'),
    };

    if (newMeeting.enable_sales_analysis) {
      newMeeting.sales_analysis = JSON.stringify({
        currentState: [],
        businessOutcomes: [],
        solutionRequirements: [],
        metrics: [],
      });
    }

    const meeting = await createMeeting(newMeeting);

    io.to('index').emit('newMeeting', meeting);
    res.redirect(`/meeting/${meeting.id}`);
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).send('Error creating meeting');
  }
});

const processAnalysis = async (
  meeting: Meeting,
  transcript_id: Transcript['id'],
) => {
  if (analysisPromises.has(meeting.bot_id)) {
    pendingAnalysis.set(
      meeting.bot_id,
      Math.max(transcript_id, pendingAnalysis.get(meeting.bot_id) || 0),
    );
    return;
  }

  console.log(
    `Processing sales analysis for meeting ${meeting.id} with transcript ${transcript_id}`,
  );

  analysisPromises.set(meeting.bot_id, transcript_id);

  const fullTranscript = await getMeetingTranscript(meeting.id);
  const salesAnalysis = await getSalesAnalysis(fullTranscript);
  io.to(`meeting_${meeting.id}`).emit('salesAnalysis', salesAnalysis);
  await updateMeeting(meeting.id, {
    sales_analysis: JSON.stringify(salesAnalysis),
  });

  analysisPromises.delete(meeting.bot_id);

  if (pendingAnalysis.has(meeting.bot_id)) {
    const nextTranscriptId = pendingAnalysis.get(meeting.bot_id)!;
    pendingAnalysis.delete(meeting.bot_id);
    processAnalysis(meeting, nextTranscriptId).catch((err) =>
      console.error('Error processing pending analysis:', err),
    );
  }
};

app.post('/webhook', async (req, res) => {
  const payload = req.body as
    | TranscriptDataPayload
    | BotInCallRecordingPayload
    | BotDonePayload
    | BotCallEndedPayload
    | null;

  console.log('Received webhook payload:', JSON.stringify(payload, null, 2));

  if (!payload) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  if (!payload.event || !payload.data || !payload.data.bot) {
    res.status(400).json({ error: 'Missing data in payload' });
    return;
  }

  const meeting = await findMeeting({ bot_id: payload.data.bot.id });
  if (!meeting) {
    console.warn(
      `Received webhook for unknown bot_id: ${payload.data.bot?.id || 'UNKNOWN'}`,
    );
    res.status(400).json({ error: 'Meeting not found for bot_id' });
    return;
  }

  if (payload.event === 'transcript.data') {
    const transcript = await createTranscript({
      meeting_id: meeting.id,
      text: payload.data.data.words.map((w) => w.text).join(' '),
      speaker: payload.data.data.participant.name || 'unknown',
      timestamps: JSON.stringify({
        start_timestamp: payload.data.data.words[0].start_timestamp,
        end_timestamp:
          payload.data.data.words[payload.data.data.words.length - 1]
            .end_timestamp,
      }),
    });

    io.to(`meeting_${meeting.id}`).emit('newTranscript', transcript);
    res.json({ success: true });

    const promises = [];
    const transcriptUpdate: Partial<TranscriptUpdate> = {};

    if (meeting.enable_definitions) {
      promises.push(
        getDefinitions(transcript.text).then((result) => {
          io.to(`meeting_${meeting.id}`).emit('transcriptUpdated', {
            id: transcript.id,
            ...result,
          });
          transcriptUpdate.definitions = JSON.stringify(result.definitions);
        }),
      );
    }
    if (meeting.enable_question_answering) {
      promises.push(
        getQuestionAnswer(transcript.text).then((result) => {
          if (!result.is_question || !result.answer) {
            return {};
          }
          io.to(`meeting_${meeting.id}`).emit('transcriptUpdated', {
            id: transcript.id,
            ...result,
          });
          transcriptUpdate.answer = result.answer;
        }),
      );
    }

    if (meeting.enable_sales_analysis) {
      processAnalysis(meeting, transcript.id).catch((err) => {
        console.error('Error processing sales analysis:', err);
      });
    }

    await Promise.all(promises);

    if (Object.keys(transcriptUpdate).length > 0) {
      await updateTranscript(transcript.id, transcriptUpdate);
    }
  } else if (payload.event === 'bot.in_call_recording') {
    const updateObj = {
      bot_status: 'in_call_recording',
      updated_at: new Date(),
    };
    await updateMeeting(meeting.id, updateObj);
    io.to('index').emit('meetingUpdated', {
      ...meeting,
      ...updateObj,
    });
    io.to(`meeting_${meeting.id}`).emit('bot_status', 'in_call_recording');
    res.json({ success: true });
  } else if (payload.event === 'bot.done') {
    const updateObj = {
      bot_status: 'done',
      updated_at: new Date(),
    };
    await updateMeeting(meeting.id, updateObj);
    io.to('index').emit('meetingUpdated', {
      ...meeting,
      ...updateObj,
    });
    io.to(`meeting_${meeting.id}`).emit('bot_status', 'done');
    res.json({ success: true });
  } else {
    res
      .status(400)
      .json({ error: `Unsupported event type: ${payload.event || 'UNKNOWN'}` });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
