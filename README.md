# annonce. — сайт

## Структура
- `index.html` — сайт.
- `content/*.json` — тексты всех блоков (RU/EN), редактируются в админке `/admin`.
- `admin/` — админка (Sveltia CMS) и `admin/crm.html` — CRM с заявками.
- `privacy.html` — политика конфиденциальности (текст в админке: «GDPR: политика, cookie, реквизиты»).
- `netlify/functions/lead.mjs` — приём заявок → CRM + Telegram.
- `netlify/functions/crm.mjs` — API CRM (защищён паролем).
- `package.json` — зависимость @netlify/blobs (хранилище заявок), Netlify ставит её сам.

## Переменные в Netlify → Site configuration → Environment variables
- `CRM_PASSWORD` — пароль входа в CRM (обязательно, длинный и сложный).
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — уведомления в Telegram (необязательно).
- `SITE_URL` — адрес сайта для ссылки на заявку в Telegram (необязательно).

После добавления переменных: Deploys → Trigger deploy → Deploy site.
