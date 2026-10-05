// Приём заявок: сохраняет в CRM (Netlify Blobs) и отправляет в Telegram.
// Переменные в Netlify → Environment variables: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (необязательно), SITE_URL (необязательно).
import { getStore } from '@netlify/blobs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cut = (s, n = 500) => String(s ?? '').slice(0, n);

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let d = {};
  try { d = await req.json(); } catch {}
  if (d.company) return Response.json({ ok: true });
  if (!d.name && !d.phone) return Response.json({ ok: false, error: 'empty' }, { status: 400 });
  if (!d.consent || !d.consent.given) return Response.json({ ok: false, error: 'consent' }, { status: 400 });
  const env = (k) => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k];

  const now = new Date().toISOString();
  const id = now.replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 8);
  const utm = d.utm && typeof d.utm === 'object' ? Object.fromEntries(Object.entries(d.utm).slice(0, 12).map(([k, v]) => [cut(k, 40), cut(v, 300)])) : {};
  const lead = {
    id, createdAt: now, updatedAt: now, status: 'new', value: 0, nextAt: '', tags: [],
    name: cut(d.name, 120), phone: cut(d.phone, 120), site: cut(d.site, 300),
    answers: Array.isArray(d.answers) ? d.answers.slice(0, 12).map((x) => ({ q: cut(x.q, 200), a: cut(x.a, 300) })) : [],
    lang: cut(d.lang, 5), page: cut(d.page, 300), source: utm.utm_source || (utm.gclid ? 'google' : utm.fbclid ? 'meta' : '') || (d.referrer ? (() => { try { return new URL(d.referrer).hostname; } catch { return 'referral'; } })() : 'direct'),
    utm, referrer: cut(d.referrer, 300),
    consent: { given: true, text: cut(d.consent.text, 400), version: cut(d.consent.version, 20), at: cut(d.consent.at, 40) || now },
    notes: [], history: [{ at: now, text: 'Заявка с сайта' }]
  };
  let saved = false;
  try { await getStore({ name: 'leads', consistency: 'strong' }).setJSON(id, lead); saved = true; } catch (e) { console.error('blobs', e); }

  const token = env('TELEGRAM_BOT_TOKEN');
  const chats = String(env('TELEGRAM_CHAT_ID') || '').split(',').map((s) => s.trim()).filter(Boolean);
  let telegram = false;
  if (token && chats.length) {
    const site = env('SITE_URL') || env('URL') || '';
    const text = [
      '<b>Новая заявка — annonce.</b>', '',
      `👤 ${esc(lead.name)}`, `📞 ${esc(lead.phone)}`, lead.site ? `🌐 ${esc(lead.site)}` : '', '',
      ...lead.answers.map((x) => `<b>${esc(x.q)}</b>\n${esc(x.a) || '—'}`), '',
      `Источник: ${esc(lead.source)}${utm.utm_campaign ? ' · ' + esc(utm.utm_campaign) : ''}`,
      site ? `CRM: ${site}/admin/crm.html#${id}` : ''
    ].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
    const results = await Promise.allSettled(chats.map((chat_id) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true })
    })));
    telegram = results.some((r) => r.status === 'fulfilled' && r.value.ok);
  }
  return Response.json({ ok: true, saved, telegram });
};

export const config = { path: '/api/lead' };
