import { API_CORS, securityHeaders } from '../core';

// Written by the preview stage, read by every pr-<n> stage.
const OUTPUTS_PARAMETER = '/yallist/preview/outputs';

interface PreviewOutputs {
  apiId: string;
  apiUrl: string;
  apiExecutionArn: string;
  distributionId: string;
}

/**
 * The preview stage: what every PR stage shares, because it's slow to create (CloudFront) or
 * has room for hundreds of PRs (an HTTP API's routes). Nothing answers outside a PR's prefix.
 * Its ids go to an SSM parameter, which PR stages read (readPreviewOutputs).
 */
export function previewShared() {
  const router = new sst.aws.Router('Router', {
    transform: {
      cdn: (args) => {
        args.comment = 'yallist-preview-router';
        securityHeaders(args);
      },
    },
  });
  const api = new sst.aws.ApiGatewayV2('Api', { cors: API_CORS });
  new aws.ssm.Parameter('Outputs', {
    name: OUTPUTS_PARAMETER,
    type: 'String',
    value: $jsonStringify({
      apiId: api.nodes.api.id,
      apiUrl: api.url,
      apiExecutionArn: api.nodes.api.executionArn,
      distributionId: router.nodes.cdn.apply((cdn) => cdn!.nodes.distribution.id),
    } satisfies Record<keyof PreviewOutputs, unknown>),
  });
  return { router: router.url, api: api.url };
}

/** The preview stage's Router and HTTP API, from a pr-<n> stage. */
export function readPreviewOutputs() {
  return aws.ssm
    .getParameterOutput({ name: OUTPUTS_PARAMETER })
    .value.apply((value) => JSON.parse(value) as PreviewOutputs);
}
