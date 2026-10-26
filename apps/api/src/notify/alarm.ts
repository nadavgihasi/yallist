import { escapeHtml } from './telegram';

/** The fields we use of the JSON a CloudWatch alarm publishes to SNS on a state change. */
type AlarmMessage = {
  AlarmName: string;
  AlarmDescription?: string | null;
  AlarmArn: string;
  NewStateValue: string;
  NewStateReason?: string;
};

const ICONS: Record<string, string> = { ALARM: '🔴', OK: '✅' };

/**
 * A Telegram message (HTML) for an SNS message: a CloudWatch alarm's state change (stage, alarm,
 * state, reason and a console link), or any other message as plain text.
 */
export function formatAlarm(stage: string, message: string) {
  let alarm: Partial<AlarmMessage> | null = null;
  try {
    alarm = JSON.parse(message) as Partial<AlarmMessage> | null;
  } catch {
    // Not JSON: not an alarm.
  }
  if (!alarm?.AlarmName || !alarm.AlarmArn || !alarm.NewStateValue) {
    return `<b>[${escapeHtml(stage)}]</b> ${escapeHtml(message, 2000)}`;
  }
  // arn:aws:cloudwatch:<region>:<account>:alarm:<name>
  const region = alarm.AlarmArn.split(':')[3] ?? '';
  const link = `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#alarmsV2:alarm/${encodeURIComponent(alarm.AlarmName)}`;
  const state = alarm.NewStateValue;
  return [
    `${ICONS[state] ?? '⚠️'} <b>[${escapeHtml(stage)}] ${escapeHtml(state)}</b>: ${escapeHtml(alarm.AlarmName)}`,
    alarm.AlarmDescription && escapeHtml(alarm.AlarmDescription),
    alarm.NewStateReason && `<i>${escapeHtml(alarm.NewStateReason)}</i>`,
    `<a href="${escapeHtml(link, Infinity)}">Open in CloudWatch</a>`,
  ]
    .filter(Boolean)
    .join('\n');
}
