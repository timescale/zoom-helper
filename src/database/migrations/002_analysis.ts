import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('meeting')
    .addColumn('sales_analysis', 'jsonb')
    .execute();
}
