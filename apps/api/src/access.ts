import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

export const fail = (status: ContentfulStatusCode, message: string) =>
  new HTTPException(status, { message });

/** zValidator that fails with our `{ error }` 400, which keeps it out of the typed responses. */
export const validate = <T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  zValidator(target, schema, (result) => {
    if (!result.success) throw fail(400, z.prettifyError(result.error));
  });
