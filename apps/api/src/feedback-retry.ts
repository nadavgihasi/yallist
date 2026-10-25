import { Resource } from 'sst';

import { connect, createDb } from './db/client';
import { feedbackToken, sendUnsentFeedback } from './feedback-issue';

/** deploy.yml runs this after migrations, with the stage's linked resources (`sst shell`). */
const token = feedbackToken(Resource.GithubFeedbackToken.value);
if (token) {
  const sql = connect();
  const { sent, waiting } = await sendUnsentFeedback(createDb(sql), token);
  console.log(`Feedback issues opened: ${sent} of ${waiting} waiting`);
  await sql.end();
}
