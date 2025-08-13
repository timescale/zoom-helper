import { db, NewTranscript, Transcript, TranscriptUpdate } from '../database';

export const getMeetingTranscript = async (meeting_id: number) => {
  return await db
    .selectFrom('transcript')
    .selectAll()
    .where('meeting_id', '=', meeting_id)
    .orderBy('start_relative', 'asc')
    .execute();
};

export const findTranscript = async (transcript: Partial<Transcript>) => {
  let query = db.selectFrom('transcript');

  if (transcript.id) {
    query = query.where('id', '=', transcript.id);
  }

  return await query.selectAll().executeTakeFirst();
};

export const createTranscript = async (data: NewTranscript) => {
  return await db
    .insertInto('transcript')
    .values(data)
    .returningAll()
    .executeTakeFirstOrThrow();
};

export const updateTranscript = async (
  id: number,
  update: TranscriptUpdate,
) => {
  return await db
    .updateTable('transcript')
    .set(update)
    .where('id', '=', id)
    .execute();
};
