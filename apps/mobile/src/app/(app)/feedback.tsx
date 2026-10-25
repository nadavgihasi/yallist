import { router } from 'expo-router';

import { FeedbackForm } from '@/features/profile/FeedbackForm';

/** Back to the profile; opened by URL, there's nothing under the sheet, so go there. */
const close = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

export default function Feedback() {
  return <FeedbackForm onClose={close} />;
}
