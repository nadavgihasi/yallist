// Types for the linked resources this package reads. SST's generated sst-env.d.ts isn't
// committed, so CI type-checks against this instead.
import 'sst';

declare module 'sst' {
  export interface Resource {
    Api: { url: string };
    App: { name: string; stage: string };
    BetterAuthSecret: { value: string };
    Database: { endpoint: string; region: string };
    GithubFeedbackToken: { value: string };
    GithubWebhookSecret: { value: string };
    GoogleClientSecret: { value: string };
    Realtime: { http: string };
    RoutineFireToken: { value: string };
    Receipts: { name: string };
    SentryDsn: { value: string };
    SentryWebhookSecret: { value: string };
    TelegramBotToken: { value: string };
    TelegramApproverIds: { value: string };
    TelegramChatId: { value: string };
    TelegramPipelineChatId: { value: string };
    TelegramWebhookSecret: { value: string };
    Web: { url: string };
  }
}
