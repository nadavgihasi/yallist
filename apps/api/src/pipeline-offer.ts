import { Resource } from 'sst';

import { findFeedback } from './dal/feedback';
import { connect, createDb } from './db/client';
import { telegramConfig } from './notify/telegram';
import { offerRequest, pipelineTelegram } from './pipeline';

/**
 * Offers feature requests that are already issues on Telegram, e.g. ones sent before the pipeline
 * existed: `pnpm sst shell --stage production -- pnpm --filter @yallist/api pipeline:offer 135 136`
 * (docs/deploy.md). A request offered before is skipped.
 */
const issues = process.argv.slice(2).map(Number);
const optional = (value: string) => (['', 'unset'].includes(value) ? null : value);
const chat = pipelineTelegram(
  telegramConfig(Resource.TelegramBotToken.value, Resource.TelegramChatId.value),
  optional(Resource.TelegramPipelineChatId.value),
  optional(Resource.TelegramApproverIds.value),
);
if (!chat || !issues.length || issues.some((n) => !Number.isInteger(n))) {
  console.error('Usage: pipeline:offer <issue>… (with the stage’s Telegram bot set)');
  process.exit(1);
}
const sql = connect();
const db = createDb(sql);
// Only Telegram is used to offer; the other settings matter once a button is pressed.
const config = {
  ...chat,
  telegramSecret: '',
  githubToken: null,
  routine: null,
  githubSecret: null,
};
for (const issue of issues) {
  const row = await findFeedback(db, 'githubIssueNumber', issue);
  const offered = row && (await offerRequest(db, config, row));
  console.log(
    `#${issue}: ${offered ? 'offered' : row ? `skipped (${row.kind}, ${row.pipelineState ?? 'not offered'})` : 'no such request'}`,
  );
}
await sql.end();
