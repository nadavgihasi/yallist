import { describe, expect, it } from 'vitest';

import { formatAlarm } from './alarm';

const alarm = {
  AlarmName: 'yallist-production-api-errors',
  AlarmDescription: 'API Lambda crashed or timed out',
  AlarmArn: 'arn:aws:cloudwatch:eu-central-1:123456789012:alarm:yallist-production-api-errors',
  NewStateValue: 'ALARM',
  OldStateValue: 'OK',
  NewStateReason: 'Threshold Crossed: 1 datapoint [4.0 (26/10/26 18:00:00)] was >= 3.0 & <b>',
};

describe('formatAlarm', () => {
  it('formats a CloudWatch alarm state change', () => {
    expect(formatAlarm('production', JSON.stringify(alarm))).toBe(
      [
        '🔴 <b>[production] ALARM</b>: yallist-production-api-errors',
        'API Lambda crashed or timed out',
        '<i>Threshold Crossed: 1 datapoint [4.0 (26/10/26 18:00:00)] was &gt;= 3.0 &amp; &lt;b&gt;</i>',
        '<a href="https://eu-central-1.console.aws.amazon.com/cloudwatch/home?region=eu-central-1#alarmsV2:alarm/yallist-production-api-errors">Open in CloudWatch</a>',
      ].join('\n'),
    );
  });

  it('marks recovery', () => {
    const ok = { ...alarm, NewStateValue: 'OK', AlarmDescription: null };
    expect(formatAlarm('production', JSON.stringify(ok))).toMatch(
      /^✅ <b>\[production\] OK<\/b>: yallist-production-api-errors\n<i>/,
    );
  });

  it('passes other messages through as escaped text', () => {
    expect(formatAlarm('dev', 'hello <world>')).toBe('<b>[dev]</b> hello &lt;world&gt;');
    expect(formatAlarm('dev', '{"a":1}')).toBe('<b>[dev]</b> {&quot;a&quot;:1}');
  });
});
