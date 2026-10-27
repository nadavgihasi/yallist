import { appCore } from '../core';
import { readPreviewOutputs } from './preview-shared';

// A PR's stage is removed this long after its last deploy (preview-cleanup.yml).
const TTL_HOURS = 6;

/**
 * A pr-<n> stage: the app, as in dev, on the preview stage's Router and HTTP API under /pr-<n>.
 * Deployed by the preview role (infra/global/preview.ts), so it can only touch its own stage.
 */
export function previewPr() {
  // Every role a PR stage creates (its Lambdas') is capped by the boundary (infra/global).
  const boundary = $interpolate`arn:aws:iam::${aws.getCallerIdentityOutput().accountId}:policy/yallist-preview-workload-boundary`;
  $transform(aws.iam.Role, (args) => {
    args.permissionsBoundary = boundary;
  });

  const shared = readPreviewOutputs();
  const prefix = `/${$app.stage}`;
  // The app serves itself under the prefix (apps/api/src/app.ts).
  const apiUrl = $interpolate`${shared.apiUrl}${prefix}`;
  const api = new sst.Linkable('Api', { properties: { url: apiUrl } });
  const { web, apiFunction } = appCore({
    api,
    apiUrl,
    preview: { router: sst.aws.Router.get('Router', shared.distributionId), prefix },
  });

  // The PR's route on the shared HTTP API: `ANY /pr-<n>/{proxy+}` to its own Lambda.
  const fn = new sst.aws.Function('ApiFunction', {
    ...apiFunction,
    // When preview-cleanup.yml removes this stage.
    tags: { 'expires-at': new Date(Date.now() + TTL_HOURS * 3600_000).toISOString() },
  });
  const integration = new aws.apigatewayv2.Integration('ApiIntegration', {
    apiId: shared.apiId,
    integrationType: 'AWS_PROXY',
    integrationUri: fn.arn,
    payloadFormatVersion: '2.0',
  });
  new aws.apigatewayv2.Route('ApiRoute', {
    apiId: shared.apiId,
    routeKey: `ANY ${prefix}/{proxy+}`,
    target: $interpolate`integrations/${integration.id}`,
  });
  new aws.lambda.Permission('ApiInvoke', {
    action: 'lambda:InvokeFunction',
    function: fn.name,
    principal: 'apigateway.amazonaws.com',
    sourceArn: $interpolate`${shared.apiExecutionArn}/*`,
  });
  return { url: web.url, api: apiUrl };
}
