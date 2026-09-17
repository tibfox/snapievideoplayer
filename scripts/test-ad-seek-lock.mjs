/**
 * 🔒 The countdown locks the timeline.
 *
 * "Ad in 3" used to be a warning with no teeth: it named the exact second to drag the
 * handle past, and the scrubber was still live to do it with, so the hint meant to make
 * a break bearable was what taught viewers to skip it. From the moment the hint appears
 * until the spot has run, a forward seek past the cut is refused: by bar, by key, and by
 * the 'seeking' backstop that catches every other path into currentTime.
 *
 * ⚠️ This player's adBreak is the OLDER one, with no spent-spot machinery (no noteTime,
 * no spotConsumed, no skipTargetFor). Scrubbing back over a spot replays it here rather
 * than jumping it, so the lock re-arms on a rewind — consistent with the ad genuinely
 * playing again. dev-player's suite covers the spotConsumed cases that do not exist here.
 *
 * 🚨 STUBBED fetch: no checker, no session, no impression booked against a real
 * campaign. Nothing here touches the money path.
 *
 * Usage: node scripts/test-ad-seek-lock.mjs
 */
const SID = 'c'.repeat(32);

function stub(start, duration) {
  global.fetch = async (url) => {
    if (String(url).endsWith('/m/session')) {
      return { ok: true, json: async () => ({
        ad: { manifestUrl: `/m/${SID}.m3u8`, position: start, durationSeconds: duration },
      }) };
    }
    return { ok: true, json: async () => ({ adStartAt: start, adDurationSeconds: duration }) };
  };
}

global.window = { __AD_BASE__: 'http://127.0.0.1:3131', location: { href: 'http://x/' } };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const { createAdBreak, AD_COUNTDOWN_FROM } = await import('../src/adBreak.js');

let pass = 0, fail = 0;
const ok = (name, got, want) => {
  const good = JSON.stringify(got) === JSON.stringify(want);
  console.log((good ? '    ok   ' : '    FAIL ') + name + (good ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`));
  good ? pass++ : fail++;
};

async function spotAt(start, duration) {
  stub(start, duration);
  const ab = createAdBreak();
  await ab.request({ owner: 'badadib', permlink: 'p', manifestUrl: 'http://m/x.m3u8' });
  await ab.resolve();
  return ab;
}

console.log(`\n  countdown window: ${AD_COUNTDOWN_FROM}s\n`);

console.log('  a mid-roll at 60..70');
const ab = await spotAt(60, 10);
ok('far from the cut: no hint', ab.countdownAt(20), null);
ok('far from the cut: no lock', ab.seekLocked(20), false);
/* 🚨 The hole this does NOT close. A viewer who drags from 20s to 90s never sees the
 * countdown, so nothing arms and the ad is skipped. Locking that too would yank anyone
 * who scrubs a long way into an ad they were never warned about: a product decision,
 * not a bug fix. Asserted so the day it changes, this line says it was deliberate. */
ok('a long drag past an unwarned break is still allowed', ab.lockedSeekTarget(90, 20), null);

ok('the hint appears at 57.2s', ab.countdownAt(57.2), 3);
ok('and the lock is on with it', ab.seekLocked(57.2), true);
ok('dragging past the ad: refused, playhead stays', ab.lockedSeekTarget(95, 57.2), 57.2);
ok('dragging to the far edge of it: refused too', ab.lockedSeekTarget(70.4, 58), 58);
ok('rewinding out of the countdown: allowed', ab.lockedSeekTarget(10, 58), null);

console.log('\n  inside the spot');
ok('still locked while the ad runs', ab.seekLocked(62), true);
ok('no fast-forward within the ad', ab.lockedSeekTarget(68, 62), 62);
ok('no jumping out of the ad', ab.lockedSeekTarget(120, 62), 62);

console.log('\n  past the end');
ok('lock is off', ab.seekLocked(71), false);
ok('and seeking is free again', ab.lockedSeekTarget(200, 71), null);

console.log('\n  a pre-roll, which never shows a hint');
const pre = await spotAt(0, 8);
ok('no hint at t=0', pre.countdownAt(0), null);
/* The latch earning its keep: locking on position alone would be true at t=0 here and
 * would refuse the legitimate seeks that happen at load, such as a deep link. */
ok('lock stays off, so a deep link still works', pre.seekLocked(0), false);
ok('the deep-link seek is let through', pre.lockedSeekTarget(120, 0), null);

console.log('\n  the caller contract');
const near = await spotAt(60, 10);
near.countdownAt(57.5);
/* A frame of ordinary playback and a one-frame seek are the same two numbers here, so
 * this answers "refused" to both. That is why the guard in main.js binds to 'seeking'
 * and never to the tick: refusing ordinary playback pins the playhead a frame short of
 * the cut and the spot can never start. */
ok('a frame of playback is indistinguishable from a seek', near.lockedSeekTarget(60.02, 59.98), 59.98);

console.log('\n  a playback with no spot');
const none = createAdBreak();
ok('nothing locks', none.seekLocked(10), false);
ok('nothing is refused', none.lockedSeekTarget(200, 10), null);
ok('no hint', none.countdownAt(10), null);

console.log('\n  %d passed, %d failed\n', pass, fail);
process.exit(fail ? 1 : 0);
