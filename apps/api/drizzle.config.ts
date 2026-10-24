import { defineConfig } from 'drizzle-kit';

/** `pnpm db:generate` writes SQL migrations to drizzle/; `pnpm db:migrate` applies them. */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
