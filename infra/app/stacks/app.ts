import { monitoring } from '../monitoring';
import { API_CORS, appCore } from '../core';

/** dev and production: the app with an HTTP API of its own, and its monitoring. */
export function app() {
  // Its `$default` route sends every path to the one API Lambda.
  const api = new sst.aws.ApiGatewayV2('Api', { cors: API_CORS });
  const { web, apiFunction, realtimeAuthorizer, telegram } = appCore({ api, apiUrl: api.url });
  const route = api.route('$default', apiFunction);
  monitoring({
    apiId: api.nodes.api.id,
    apiFunction: route.nodes.function.name,
    realtimeAuthorizer: realtimeAuthorizer.name,
    telegram,
  });
  return { url: web.url, api: api.url };
}
