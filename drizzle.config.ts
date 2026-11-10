import { defineConfig } from 'drizzle-kit';

/** `bunx drizzle-kit generate` turns schema changes into a new migration in src/lib/db/migrations. */
export default defineConfig({
  schema: './src/lib/db/schema.database.ts',
  out: './src/lib/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
});
