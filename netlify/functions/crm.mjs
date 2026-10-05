// API для CRM в админке. Пароль задаётся переменной CRM_PASSWORD в Netlify → Environment variables.
import { getStore } from '@netlify/blobs';

const STATUSES = ['new', 'work', 'proposal', 'won', 'lost'];
const EDITABLE = ['status', 'name', 'phone', 'site', 'value', 'nextAt', 'tags', 'owner', 'company', 'email'];
const cut = (s, n = 500) => String(s ?? '').slice(0, n);
const same = (a, b) => { a = String(a); b = String(b); if (!a || a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

export default async (req) => {
  const env = (k) => (globalThis.Netlify?.env?.get?.(k)) ?? process.env[k];
  const pass = env('CRM_PASSWORD');
  if (!pass) return Response.json({ ok: false, error: 'no_password' }, { status: 503 });
  const auth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!same(auth, pass)) { await new Promise((r) => setTimeout(r, 600)); return Response.json({ ok: false, error: 'auth' }, { status: 401 }); }
  const store = getStore({ name: 'leads', consistency: 'strong' });
  const H = { 'Cache-Control': 'no-store' };

  if (req.method === 'GET') {
    const { blobs } = await store.list();
    const leads = (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }).catch(() => null)))).filter(Boolean);
    leads.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return Response.json({ ok: true, leads }, { headers: H });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let d = {};
  try { d = await req.json(); } catch {}
  const now = new Date().toISOString();

  if (d.action === 'create') {
    const id = now.replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 8);
    const l = d.lead || {};
    const lead = { id, createdAt: now, updatedAt: now, status: STATUSES.includes(l.status) ? l.status : 'new', value: +l.value || 0, nextAt: cut(l.nextAt, 30), tags: [], name: cut(l.name, 120), phone: cut(l.phone, 120), site: cut(l.site, 300), email: cut(l.email, 120), company: cut(l.company, 120), answers: [], source: cut(l.source || 'manual', 60), utm: {}, notes: l.note ? [{ at: now, text: cut(l.note, 2000) }] : [], history: [{ at: now, text: 'Добавлена вручную' }], consent: { given: false, text: 'Добавлена вручную менеджером', at: now } };
    await store.setJSON(id, lead);
    return Response.json({ ok: true, lead }, { headers: H });
  }

  const id = cut(d.id, 60);
  if (!id) return Response.json({ ok: false, error: 'id' }, { status: 400 });

  if (d.action === 'delete') { await store.delete(id); return Response.json({ ok: true }, { headers: H }); }

  const lead = await store.get(id, { type: 'json' });
  if (!lead) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  lead.notes = lead.notes || []; lead.history = lead.history || [];

  if (d.action === 'update') {
    const p = d.patch || {};
    for (const k of EDITABLE) if (k in p) {
      if (k === 'status' && !STATUSES.includes(p.status)) continue;
      if (k === 'status' && p.status !== lead.status) lead.history.push({ at: now, text: `Статус: ${lead.status} → ${p.status}` });
      lead[k] = k === 'value' ? (+p.value || 0) : k === 'tags' ? (Array.isArray(p.tags) ? p.tags.slice(0, 10).map((t) => cut(t, 30)) : []) : cut(p[k], 300);
    }
  } else if (d.action === 'note') {
    const text = cut(d.text, 2000).trim();
    if (text) lead.notes.push({ at: now, text });
  } else if (d.action === 'deleteNote') {
    lead.notes = lead.notes.filter((n) => n.at !== d.at);
  } else return Response.json({ ok: false, error: 'action' }, { status: 400 });

  lead.updatedAt = now;
  await store.setJSON(id, lead);
  return Response.json({ ok: true, lead }, { headers: H });
};

export const config = { path: '/api/crm' };
