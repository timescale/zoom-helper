import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('meeting')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('bot_id', 'varchar', (col) => col.notNull())
    .addColumn('bot_status', 'varchar', (col) => col.notNull())
    .addColumn('enable_definitions', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('enable_question_answering', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('enable_sales_analysis', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await db.schema
    .createIndex('bot_id_idx')
    .on('meeting')
    .column('bot_id')
    .execute();

  await db.schema
    .createTable('transcript')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('meeting_id', 'integer', (col) =>
      col.notNull().references('meeting.id').onDelete('cascade'),
    )
    .addColumn('text', 'text', (col) => col.notNull())
    .addColumn('speaker', 'varchar', (col) => col.notNull())
    .addColumn('timestamps', 'jsonb', (col) => col.notNull())
    .addColumn('start_relative', 'real', (col) =>
      col
        .generatedAlwaysAs(
          sql`((timestamps->'start_timestamp'->>'relative')::float)`,
        )
        .stored(),
    )
    .addColumn('definitions', 'jsonb')
    .addColumn('answer', 'text')
    .execute();

  await db.schema
    .createIndex('start_relative_idx')
    .on('transcript')
    .column('start_relative')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('start_relative_idx').ifExists().execute();
  await db.schema.dropTable('transcript').ifExists().execute();
  await db.schema.dropIndex('bot_id_idx').ifExists().execute();
  await db.schema.dropTable('meeting').ifExists().execute();
}
