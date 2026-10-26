import { API_CORS, API_TIMEOUT_SECONDS, appCore } from '../core';

/** dev and production: the app with an HTTP API of its own, and alerts. */
export function app() {
  // Its `$default` route sends every path to the one API Lambda.
  const api = new sst.aws.ApiGatewayV2('Api', { cors: API_CORS });
  const { web, apiFunction, realtimeAuthorizer, telegram } = appCore({ api, apiUrl: api.url });
  const route = api.route('$default', apiFunction);
  alerts(api.nodes.api.id, route.nodes.function.name, realtimeAuthorizer.name, telegram);
  return { url: web.url, api: api.url };
}

/**
 * Alerts: CloudWatch alarms publish to an SNS topic on ALARM and OK (CloudWatch only notifies on a
 * state change, never repeats), and the notifier posts each to Telegram
 * (apps/api/src/alarm-notifier.ts). Production only; dev has the topic, no alarms; PRs neither.
 */
function alerts(
  apiId: $util.Input<string>,
  apiFunction: $util.Input<string>,
  realtimeAuthorizer: $util.Input<string>,
  telegram: sst.Secret[],
) {
  const topic = new sst.aws.SnsTopic('Alerts');
  topic.subscribe('AlertsNotifier', {
    handler: '../../apps/api/src/alarm-notifier.handler',
    runtime: 'nodejs24.x',
    link: telegram,
  });
  if ($app.stage === 'production') {
    const lambda = (fn: $util.Input<string>, metricName: string) => ({
      namespace: 'AWS/Lambda',
      metricName,
      dimensions: { FunctionName: fn },
    });
    alarm('ApiErrors', 'API Lambda invocations failed (crash, timeout or out of memory)', {
      ...lambda(apiFunction, 'Errors'),
      threshold: 3,
    });
    alarm('ApiThrottles', 'API Lambda invocations throttled (concurrency limit)', {
      ...lambda(apiFunction, 'Throttles'),
      threshold: 1,
    });
    alarm('ApiDuration', `API Lambda took over 80% of its ${API_TIMEOUT_SECONDS}s timeout`, {
      ...lambda(apiFunction, 'Duration'),
      statistic: 'Maximum',
      threshold: API_TIMEOUT_SECONDS * 1000 * 0.8,
    });
    alarm('Api5xx', 'API Gateway answered 5xx (unhandled errors in the API)', {
      namespace: 'AWS/ApiGateway',
      metricName: '5xx',
      dimensions: { ApiId: apiId },
      threshold: 5,
    });
    alarm('RealtimeAuthorizerErrors', 'Realtime authorizer failed: clients cannot subscribe', {
      ...lambda(realtimeAuthorizer, 'Errors'),
      threshold: 3,
    });
  }

  /**
   * A 5-minute alarm on `metric` reaching `threshold` (summed unless `statistic` says otherwise)
   * that notifies the Alerts topic on ALARM and on OK. No data (no traffic) counts as healthy.
   */
  function alarm(
    name: string,
    description: string,
    metric: Pick<
      aws.cloudwatch.MetricAlarmArgs,
      'namespace' | 'metricName' | 'dimensions' | 'threshold' | 'statistic'
    >,
  ) {
    new aws.cloudwatch.MetricAlarm(`Alarm${name}`, {
      name: `${$app.name}-${$app.stage}-${name}`,
      alarmDescription: description,
      statistic: 'Sum',
      ...metric,
      period: 300,
      evaluationPeriods: 1,
      comparisonOperator: 'GreaterThanOrEqualToThreshold',
      treatMissingData: 'notBreaching',
      alarmActions: [topic.arn],
      okActions: [topic.arn],
    });
  }
}
