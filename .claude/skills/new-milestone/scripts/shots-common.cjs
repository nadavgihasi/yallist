// Helpers for Playwright screenshot and review scripts against serve-stack.sh.
// Run with SMOKE_DB=<the name in qa-db.txt>. DOM ids are the app's testIDs.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const API = 'http://localhost:3100';
const WEB = 'http://localhost:8180/';
const PG = process.env.PG_URL ?? 'postgres://postgres:postgres@localhost:5432';
const DB = process.env.SMOKE_DB;

// Reads one value from the test database (e.g. a trip's invite token).
const q = (sql) =>
  execFileSync('psql', ['-tA', `${PG}/${DB}`, '-c', sql])
    .toString()
    .trim();

// A guest user made through the API, with headers for `call`.
async function guest(name) {
  const r = await fetch(API + '/api/auth/sign-in/anonymous', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const b = await r.json();
  return {
    id: b.user.id,
    h: { authorization: `Bearer ${b.token}`, 'content-type': 'application/json' },
  };
}

async function call(u, method, path, body) {
  const r = await fetch(API + path, { method, headers: u.h, body: body && JSON.stringify(body) });
  if (r.status >= 300) throw new Error(`${method} ${path} ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

// A phone-sized page signed in as the guest "דנה".
async function start() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const tid = (id) => page.locator(`#${id}`).filter({ visible: true }).first();
  await page.goto(WEB);
  await tid('login-guest').click();
  await tid('login-name').fill('דנה');
  await tid('login-start').click();
  await tid('home-new-trip').waitFor();
  return { browser, page, tid };
}

// Creates a blank trip in the UI; returns its id, invite token and the creator's user id.
async function newTrip(page, tid, name) {
  await page.goto(WEB);
  await tid('home-new-trip').click();
  await tid('new-trip-template-blank').click();
  await tid('new-trip-name').fill(name);
  await tid('new-trip-create').click();
  await tid('trip-title').waitFor();
  const tripId = page.url().match(/trips\/([0-9a-f-]{36})/)[1];
  return {
    tripId,
    token: q(`select invite_token from trips where id='${tripId}'`),
    dana: q(`select user_id from trip_members where trip_id='${tripId}'`),
  };
}

// Lets queries refetch and animations end before a screenshot.
const settle = (page) => page.waitForTimeout(1200);

module.exports = { API, WEB, guest, call, start, newTrip, settle, q };
