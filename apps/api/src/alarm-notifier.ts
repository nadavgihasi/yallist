import { Resource } from 'sst';

import { formatAlarm } from './notify/alarm';
import { sendTelegram, telegramConfig } from './notify/telegram';

const telegram = telegramConfig(Resource.TelegramBotToken.value, Resource.TelegramChatId.value);

/**
 * Subscriber of the stage's Alerts SNS topic (infra/app/sst.config.ts): posts each CloudWatch
 * alarm state change to Telegram. A failed send throws, so Lambda retries the event.
 */
export const handler = async (event: { Records: { Sns: { Message: string } }[] }) => {
  for (const record of event.Records) {
    await sendTelegram(telegram, formatAlarm(Resource.App.stage, record.Sns.Message));
  }
};
