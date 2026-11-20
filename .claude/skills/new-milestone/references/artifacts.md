# Artifacts

Three kinds of artifact carry a milestone. They're private until the user shares them, so say that when a page is meant for others. Load the artifact tool's own guidance before writing each one (`action: "quickstart"` with the right intent), and follow the type's instructions over anything here.

## 1. The plan page (stage 3)

- Make it a plain page (`intent: "other"`, untyped): one reading column, English, the app's palette (paper ground, violet for links and buttons) in light and dark themes.
- Title it with a name, such as "Money Parity Plan". The description says what it is for.
- Use this structure:
  1. A header with an eyebrow (area, date), the title, and a one-line lede.
  2. "How to hand a task to a session".
  3. **Shared context**: where things stand, where the code is, conventions, and what not to add.
  4. **Build order**: a table of Batch | Tasks | What it gives the group, plus the dependencies in prose.
  5. One section per task: id chip, title, a "Copy brief" button, a meta row (size, API/app, depends), then **Why**, **Today** (with file paths), **Build** (bullets), **Done when** (checkable).
  6. **Left out on purpose**.
- The "Copy brief" script clones the task section, drops the button, and copies `Implement task <id> …` plus the task text plus the shared context. Fall back to `execCommand('copy')` when `navigator.clipboard` refuses.

## 2. The design canvas (stage 4 and the now-vs-proposed rows in stage 6)

- Start from the **Design** type: run `quickstart` with `intent: "design"`, then publish with the type's `type_url`, a title and `auto_open: "after_first_write"`. Follow the instructions in its result: `project/canvas.json` first, then one `.dc.html` per artboard, sent in the order it gives.
- Install the Yallist design system the way the type explains (its `tokens.json` into `project/ds/yallist/`, plus a `designSystems` record). If its colours lag behind `theme/index.ts`, use the theme's values and say so in a sticky note.
- Artboards are phone frames, 390 wide and as tall as their content, `lang="he" dir="rtl"`, with Rubik from Google Fonts. Use real `<button>` elements and `aria-label`s, and inline stroke SVG icons rather than emoji.
- Lay them out in rows, one row per area, with a `title1` note above each row and a sticky note for the sample data and assumptions.
- **Now vs proposed**: upload the real screenshots as assets (`asset: true`, `file_paths`). Make one artboard that is just the `<img>` of the current screen, and next to it an artboard mocking the change. Give them the same number in both titles ("3 · Now: …" / "3 · Proposed: …"), and add a sticky note listing the numbers so the user can answer "1, 3, 4" or "all".
- Before changing the layout, re-read `canvas.json`, then publish only the changed files.

## 3. The comparison page (stage 7)

- A plain page with the screenshots as supporting files: `files` maps `img/x.png` to its local path, and the HTML references `img/x.png`.
- Use this structure:
  1. Eyebrow and title ("Yallist vs Splitwise"), and a lede naming the three reviews.
  2. A three-card verdict: where we are at parity, the biggest gap, and what comes next.
  3. **Screen by screen**: per pair, a grid of [ours | theirs | notes], with tags "Yallist" and the competitor, and notes as a definition list (theirs, ours, suggestion). End each pair with a call chip ("Splitwise clearer per row", "Yallist clearer for one trip"). The grid stacks on phones.
  4. **What they have that we don't**: a table of Feature | Why people want it | Relevance | Effort | Notes, with PRO and LEFT OUT tags.
  5. **Where we do it differently: let's talk**: cards with what differs, a recommendation (keep / align / discuss) and a question.
  6. **Where we're ahead**: one of our screenshots next to a list.
  7. **What users say**: 4 quotes with links, plus the most-voted requests.
  8. **Recommended next batch**: an ordered list, each item with which review backed it.
  9. A sources footnote. Competitor images come from public store and help pages, used for internal comparison, and nobody signed in.
- Before captioning the competitor images, look at them, so each caption says what the image really shows.
