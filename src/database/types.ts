import {
  ColumnType,
  Generated,
  Insertable,
  JSONColumnType,
  Selectable,
  Updateable,
} from 'kysely';

export interface MeetingTable {
  id: Generated<number>;
  bot_id: string;
  bot_status: string;
  enable_definitions: boolean;
  enable_question_answering: boolean;
  enable_sales_analysis: boolean;
  sales_analysis: JSONColumnType<{
    currentState: string[];
    businessOutcomes: string[];
    solutionRequirements: string[];
    metrics: string[];
  }> | null;
  created_at: ColumnType<Date, never, Date>;
  updated_at: ColumnType<Date, never, Date>;
}

export type Meeting = Selectable<MeetingTable>;
export type NewMeeting = Insertable<MeetingTable>;
export type MeetingUpdate = Updateable<MeetingTable>;

export interface TranscriptTable {
  id: Generated<number>;
  meeting_id: number;
  text: string;
  speaker: string;
  timestamps: JSONColumnType<{
    start_timestamp: JSONColumnType<{
      relative: number;
      absolute: string;
    }>;
    end_timestamp: JSONColumnType<{
      relative: number;
      absolute: string;
    }> | null;
  }>;
  // This is a generated column based on (timestamps->start_timestamp->>relative)::float
  start_relative: Generated<number>;
  definitions: JSONColumnType<{ word: string; definition: string }[]> | null;
  answer: string | null;
}

export type Transcript = Selectable<TranscriptTable>;
export type NewTranscript = Insertable<TranscriptTable>;
export type TranscriptUpdate = Updateable<TranscriptTable>;

export interface Database {
  meeting: MeetingTable;
  transcript: TranscriptTable;
}
