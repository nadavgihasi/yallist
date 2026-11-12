import * as Clipboard from 'expo-clipboard';

/** Copies `text`; false where it can't (a browser without clipboard access). */
export async function copyText(text: string): Promise<boolean> {
  try {
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}
