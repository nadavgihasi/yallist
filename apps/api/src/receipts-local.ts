import { Hono } from 'hono';

import type { ReceiptStore } from './receipts';

/**
 * The receipts bucket in memory, for tests and the local dev server (no AWS). `routes`, mounted
 * at `baseURL`, take the upload form like S3 would, enforcing the same policy, and serve the files.
 */
export function localReceiptStore(baseURL: string) {
  const objects = new Map<string, { contentType: string; body: Blob }>();
  const forms = new Map<string, { contentType: string; maxBytes: number }>();

  const store: ReceiptStore = {
    async uploadForm(key, contentType, maxBytes) {
      forms.set(key, { contentType, maxBytes });
      return { url: `${baseURL}/upload`, fields: { key, 'Content-Type': contentType } };
    },
    async head(key) {
      const object = objects.get(key);
      return object && { size: object.body.size, contentType: object.contentType };
    },
    viewUrl: async (key) => `${baseURL}/view/${key}`,
    cachedViewUrl: async (key) => `${baseURL}/view/${key}`,
    async delete(key) {
      objects.delete(key);
    },
  };

  const routes = new Hono()
    .post('/upload', async (c) => {
      const form = await c.req.formData();
      const key = form.get('key');
      const contentType = form.get('Content-Type');
      const file = form.get('file');
      if (typeof key !== 'string' || !(file instanceof Blob)) return c.body(null, 403);
      const policy = forms.get(key);
      if (policy?.contentType !== contentType) return c.body(null, 403);
      if (file.size < 1 || file.size > policy.maxBytes) return c.body(null, 400);
      objects.set(key, { contentType: policy.contentType, body: file });
      return c.body(null, 204);
    })
    .get('/view/*', (c) => {
      const object = objects.get(c.req.path.slice(c.req.path.indexOf('/view/') + 6));
      if (!object) return c.body(null, 404);
      return c.body(object.body.stream(), 200, { 'content-type': object.contentType });
    });

  return { store, objects, routes };
}
