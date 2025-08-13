import { db, Meeting, MeetingUpdate, NewMeeting } from '../database';

export const getMeetings = async () => {
  return await db
    .selectFrom('meeting')
    .selectAll()
    .orderBy('updated_at', 'desc')
    .execute();
};

export const selectMeetingById = async (id: number) => {
  return await db
    .selectFrom('meeting')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
};

export const selectMeetingByBotId = async (bot_id: string) => {
  return await db
    .selectFrom('meeting')
    .selectAll()
    .where('bot_id', '=', bot_id)
    .executeTakeFirst();
};

export const findMeeting = async (meeting: Partial<Meeting>) => {
  let query = db.selectFrom('meeting');

  if (meeting.id) {
    query = query.where('id', '=', meeting.id);
  }

  if (meeting.bot_id) {
    query = query.where('bot_id', '=', meeting.bot_id);
  }

  return await query.selectAll().executeTakeFirst();
};

export const createMeeting = async (meeting: NewMeeting) => {
  return await db
    .insertInto('meeting')
    .values(meeting)
    .returningAll()
    .executeTakeFirstOrThrow();
};

export const updateMeeting = async (id: number, update: MeetingUpdate) => {
  return await db
    .updateTable('meeting')
    .set({
      ...update,
      updated_at: new Date(),
    })
    .where('id', '=', id)
    .execute();
};
