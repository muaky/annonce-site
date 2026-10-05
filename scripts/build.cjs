// Netlify build: indexes for cases/blog, static pages with SEO meta, sitemap.xml, robots.txt.
const fs = require('fs');
const path = require('path');

const SITE = (process.env.URL || '').replace(/\/$/, '');
const readJSON = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const list = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readJSON(path.join(dir, f))).filter((x) => x && x.slug && !x.draft).sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))) : [];

const cases = list('content/cases');
const blog = list('content/blog');
write('content/_index/cases.json', JSON.stringify(cases, null, 2));
write('content/_index/blog.json', JSON.stringify(blog, null, 2));

const seo = readJSON('content/seo.json', {});
const L = seo.lang || 'ru';
const t = (v) => v && typeof v === 'object' ? (v[L] ?? v.ru ?? '') : (v ?? '');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (p) => !p ? '' : /^https?:/.test(p) ? p : SITE + (p.startsWith('/') ? p : '/' + p);
const plain = (md) => String(md || '').replace(/[#>*_\[\]()!`-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);

const head = ({ title, desc, url, image, type = 'website', ld }) => [
  '<meta name="annonce-build" content="1"><script>window.ANNONCE_BUILD=1</script><style>html,body{background:#07222a!important}#__bundler_thumbnail,#__bundler_loading{display:none!important}</style>',
  `<title>${esc(title)}</title>`,
  `<meta name="description" content="${esc(desc)}">`,
  SITE && `<link rel="canonical" href="${esc(url)}">`,
  `<meta property="og:type" content="${type}">`,
  `<meta property="og:site_name" content="annonce.">`,
  `<meta property="og:title" content="${esc(title)}">`,
  `<meta property="og:description" content="${esc(desc)}">`,
  SITE && `<meta property="og:url" content="${esc(url)}">`,
  image && `<meta property="og:image" content="${esc(abs(image))}">`,
  '<meta name="twitter:card" content="summary_large_image">',
  `<meta name="twitter:title" content="${esc(title)}">`,
  `<meta name="twitter:description" content="${esc(desc)}">`,
  image && `<meta name="twitter:image" content="${esc(abs(image))}">`,
  ld && `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`
].filter(Boolean).join('');
const inject = (html, extra) => html.replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<head([^>]*)>/i, (m, a) => `<head${a}>${extra}`).replace(/<html(?![^>]*\blang=)/i, () => `<html lang="${L}"`);

const ogDefault = seo.ogImage || '/og.png';
const org = { '@context': 'https://schema.org', '@type': 'Organization', name: 'annonce.', url: SITE || undefined, logo: SITE ? SITE + '/favicon.png' : undefined, description: t(seo.description) };

const index = fs.readFileSync('index.html', 'utf8');
if (!index.includes('annonce-build')) write('index.html', inject(index, head({ title: t(seo.title), desc: t(seo.description), url: SITE + '/', image: ogDefault, ld: org })));

const entry = fs.readFileSync('entry.html', 'utf8');
const pages = [{ loc: SITE + '/', lastmod: new Date().toISOString().slice(0, 10) }];
for (const c of cases) {
  const url = `${SITE}/cases/${c.slug}/`;
  write(`cases/${c.slug}/index.html`, inject(entry, head({ title: `${t(c.title)} — annonce.`, desc: t(c.text) || plain(t(c.body)), url, image: c.image || ogDefault, type: 'article', ld: { '@context': 'https://schema.org', '@type': 'Article', headline: t(c.title), image: c.image ? abs(c.image) : undefined, datePublished: c.date, publisher: org } })));
  pages.push({ loc: url, lastmod: c.date });
}
for (const p of blog) {
  const url = `${SITE}/blog/${p.slug}/`;
  write(`blog/${p.slug}/index.html`, inject(entry, head({ title: `${t(p.title)} — annonce.`, desc: t(p.excerpt) || plain(t(p.body)), url, image: p.image || ogDefault, type: 'article', ld: { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: t(p.title), image: p.image ? abs(p.image) : undefined, datePublished: p.date, publisher: org } })));
  pages.push({ loc: url, lastmod: p.date });
}
write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + pages.map((p) => `  <url><loc>${esc(p.loc)}</loc>${p.lastmod ? `<lastmod>${esc(p.lastmod)}</lastmod>` : ''}</url>`).join('\n') + '\n</urlset>\n');
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /admin/\n${SITE ? `Sitemap: ${SITE}/sitemap.xml\n` : ''}`);
console.log(`annonce build: ${cases.length} cases, ${blog.length} posts, site ${SITE || '(no URL)'}`);
