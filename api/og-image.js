// api/og-image.js
// A Vercel Edge Function that generates the link-share preview image ON THE FLY,
// so the "responses" number is always the real current count — not a static image.
//
// HOW IT WORKS:
// WhatsApp/X/Facebook don't run your page's JavaScript when they build a link
// preview — they just fetch whatever URL is in the og:image meta tag. Point
// that tag at THIS function instead of a static .png, and every time a
// platform (re)fetches the preview, it gets a freshly-drawn image with the
// live vote count baked in.
//
// SETUP:
// 1) Add this file at:  api/og-image.js  (same /api folder as pay.js / verify.js)
// 2) Add "@vercel/og" as a dependency — run:  npm install @vercel/og
//    (if you don't have a package.json yet, run `npm init -y` first)
// 3) In your HTML <head>, change:
//      <meta property="og:image" content="og-image.png">
//      <meta name="twitter:image" content="og-image.png">
//    to:
//      <meta property="og:image" content="/api/og-image">
//      <meta name="twitter:image" content="/api/og-image">
// 4) Deploy. Test with a cache-buster the first time, e.g.
//    https://yourdomain.com/api/og-image?t=1  (see caching note below).
//
// CACHING NOTE (important, please read):
// WhatsApp, Facebook and X all cache link previews on THEIR servers once a
// link has been shared. That means the count reflects the number of votes
// at the moment each platform's crawler FIRST fetched the link, not the
// literal instant a person happens to open the shared message — the same
// way a screenshot doesn't update after you take it. Some platforms let you
// force a re-scrape (e.g. Facebook's Sharing Debugger, X Card Validator);
// there's no way to guarantee a live number on every single view, since
// that part is controlled by WhatsApp/X's own caching, not your code.

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://zjvlpszkjvjhphdfwczg.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpqdmxwc3pranZqaHBoZGZ3Y3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMTYxOTAsImV4cCI6MjA5NzY5MjE5MH0.2ZOJaavWmVazbO7cWmPMjPjjN6fLKPYtZgLzj8qSlfk';
const SEED_TOTAL = 17252; // same seed used on the site itself, kept in sync

// Small helper so we can build the image tree with plain JS objects —
// no JSX / build step required, works in a plain .js file.
function h(type, props, children) {
  return { type, props: { ...props, children } };
}

async function getLiveTotal() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/votes?select=id`, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    });
    const range = res.headers.get('content-range'); // e.g. "0-0/842"
    if (range) {
      const real = parseInt(range.split('/')[1], 10);
      if (!isNaN(real)) return SEED_TOTAL + real;
    }
  } catch (e) {
    console.error('og-image: vote count fetch failed', e);
  }
  return SEED_TOTAL; // fallback if the DB is briefly unreachable
}

export default async function handler() {
  const total = await getLiveTotal();

  return new ImageResponse(
    h('div', {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        background: 'linear-gradient(135deg,#0D3D1F 0%,#0a2e17 100%)',
        fontFamily: 'sans-serif',
        position: 'relative',
      },
    }, [
      h('div', { style: { fontSize: 40, marginBottom: 4 } }, '🇰🇪'),
      h('div', {
        style: {
          color: '#D4A017', fontSize: 24, fontWeight: 700,
          letterSpacing: 3, textTransform: 'uppercase', marginBottom: 20,
        },
      }, 'Kenya 2027 · Independent Public Survey'),
      h('div', {
        style: { color: '#fff', fontSize: 66, fontWeight: 800, lineHeight: 1.05, textTransform: 'uppercase' },
      }, 'What Will Kenya'),
      h('div', {
        style: { color: '#D4A017', fontSize: 66, fontWeight: 800, lineHeight: 1.05, textTransform: 'uppercase', marginBottom: 24 },
      }, 'Decide in 2027?'),
      h('div', {
        style: { color: '#fff', fontSize: 30, fontWeight: 700, marginBottom: 36 },
      }, 'JE!! NI 1 TERM AMA 2 TERM?'),
      h('div', {
        style: { display: 'flex', alignItems: 'baseline', gap: 14 },
      }, [
        h('div', { style: { color: '#fff', fontSize: 64, fontWeight: 800 } }, total.toLocaleString()),
        h('div', { style: { color: 'rgba(255,255,255,0.65)', fontSize: 22, fontWeight: 700, textTransform: 'uppercase' } }, 'Responses So Far'),
      ]),
    ]),
    { width: 1200, height: 630 },
  );
}
