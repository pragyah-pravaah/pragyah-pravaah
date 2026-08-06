const PROJECT_ID = 'pragyah-pravaah';
const DEFAULT_SITE_URL = 'https://pragyahpravaah.netlify.app';

function htmlEscape(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function attrEscape(value = '') {
  return htmlEscape(value).replace(/`/g, '&#096;');
}

function fieldValue(field) {
  if (!field) return '';
  if (Object.prototype.hasOwnProperty.call(field, 'stringValue')) return field.stringValue;
  if (Object.prototype.hasOwnProperty.call(field, 'timestampValue')) return field.timestampValue;
  if (Object.prototype.hasOwnProperty.call(field, 'integerValue')) return Number(field.integerValue);
  if (Object.prototype.hasOwnProperty.call(field, 'doubleValue')) return Number(field.doubleValue);
  if (Object.prototype.hasOwnProperty.call(field, 'booleanValue')) return Boolean(field.booleanValue);
  if (Object.prototype.hasOwnProperty.call(field, 'nullValue')) return null;
  return '';
}

function fieldsToArticle(fields, id) {
  const article = { id };
  for (const [key, value] of Object.entries(fields || {})) article[key] = fieldValue(value);
  return article;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'article';
}

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = asDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata'
  }).format(date);
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeArticleHtml(value) {
  // The content is authored by the site owner. Remove executable and embedding tags
  // while preserving normal article formatting and safe links.
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*(["']).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, '');
}

function response(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': statusCode === 200 ? 'public, max-age=0, s-maxage=300' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      ...headers
    },
    body
  };
}

function errorPage({ siteUrl, title, message, statusCode = 404 }) {
  return response(statusCode, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${htmlEscape(title)} | Pragyah Pravaah</title><style>body{margin:0;background:#f7efdf;color:#211b18;font-family:"Times New Roman",serif;display:grid;min-height:100vh;place-items:center}.box{width:min(680px,calc(100% - 36px));padding:42px;background:#fffaf1;border:1px solid #d9c6ae;border-radius:22px;text-align:center}h1{color:#731f2f}a{display:inline-block;margin-top:16px;padding:10px 18px;border-radius:999px;background:#731f2f;color:#fff;text-decoration:none;font-weight:700}</style></head><body><main class="box"><h1>${htmlEscape(title)}</h1><p>${htmlEscape(message)}</p><a href="${attrEscape(siteUrl)}/">Return to homepage</a></main></body></html>`);
}

exports.handler = async function handler(event) {
  const host = event.headers?.['x-forwarded-host'] || event.headers?.host;
  const proto = event.headers?.['x-forwarded-proto'] || 'https';
  const siteUrl = process.env.SITE_URL || (host ? `${proto}://${host}` : DEFAULT_SITE_URL);

  const rawId = event.queryStringParameters?.id || '';
  let id;
  try { id = decodeURIComponent(rawId); } catch { id = rawId; }
  if (!id || !/^[A-Za-z0-9_-]{3,160}$/.test(id)) {
    return errorPage({ siteUrl, title: 'Article not found', message: 'This article link is incomplete or invalid.' });
  }

  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/articles/${encodeURIComponent(id)}`;
    const firestoreResponse = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (firestoreResponse.status === 404) {
      return errorPage({ siteUrl, title: 'Article not found', message: 'This article is unavailable or may have been removed.' });
    }
    if (!firestoreResponse.ok) throw new Error(`Firestore returned ${firestoreResponse.status}`);

    const document = await firestoreResponse.json();
    const article = fieldsToArticle(document.fields, id);
    const status = String(article.status || 'published').toLowerCase();
    const publishAt = asDate(article.publishAt);
    if (status !== 'published' || (publishAt && publishAt.getTime() > Date.now())) {
      return errorPage({ siteUrl, title: 'Article not available', message: 'This article is not publicly available yet.' });
    }

    const title = String(article.title || 'Article').trim();
    const slug = article.slug || slugify(title);
    const canonical = `${siteUrl}/articles/${encodeURIComponent(id)}/${encodeURIComponent(slug)}`;
    const description = String(article.excerpt || stripHtml(article.content).slice(0, 180) || 'Read a thoughtful article on Pragyah Pravaah.').trim();
    const content = sanitizeArticleHtml(article.content);
    const image = String(article.image || '').trim();
    const authorName = String(article.authorName || article.author || '').trim();
    const authorEmail = String(article.authorEmail || article.email || '').trim();
    const publishedDate = asDate(article.date) || asDate(article.createdAt) || publishAt;
    const modifiedDate = asDate(article.updatedAt) || asDate(article.dateModified) || publishedDate;
    const publishedIso = publishedDate ? publishedDate.toISOString() : '';
    const modifiedIso = modifiedDate ? modifiedDate.toISOString() : publishedIso;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      url: canonical,
      publisher: { '@type': 'Organization', name: 'Pragyah Pravaah', url: siteUrl },
      author: authorName
        ? { '@type': 'Person', name: authorName }
        : { '@type': 'Organization', name: 'Pragyah Pravaah' }
    };
    if (publishedIso) schema.datePublished = publishedIso;
    if (modifiedIso) schema.dateModified = modifiedIso;
    if (image) schema.image = [image];

    const safeSchema = JSON.stringify(schema).replace(/</g, '\\u003c');
    const coverMarkup = image ? `<img class="cover" src="${attrEscape(image)}" alt="${attrEscape(title)}" loading="eager">` : '';
    const authorMarkup = (authorName || authorEmail) ? `<section class="author-box"><h2>About the Author</h2>${authorName ? `<p><strong>Name:</strong> ${htmlEscape(authorName)}</p>` : ''}${authorEmail ? `<p><strong>Email:</strong> <a href="mailto:${attrEscape(authorEmail)}">${htmlEscape(authorEmail)}</a></p>` : ''}</section>` : '';
    const dateMarkup = publishedDate ? `<time datetime="${attrEscape(publishedIso)}">${htmlEscape(formatDate(publishedDate))}</time><span>•</span>` : '';
    const readTime = htmlEscape(article.readTime || '4 min read');

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f7efdf">
<title>${htmlEscape(title)} | Pragyah Pravaah</title>
<meta name="description" content="${attrEscape(description)}">
<link rel="canonical" href="${attrEscape(canonical)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Pragyah Pravaah">
<meta property="og:title" content="${attrEscape(title)}">
<meta property="og:description" content="${attrEscape(description)}">
<meta property="og:url" content="${attrEscape(canonical)}">
${image ? `<meta property="og:image" content="${attrEscape(image)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attrEscape(title)}">
<meta name="twitter:description" content="${attrEscape(description)}">
${image ? `<meta name="twitter:image" content="${attrEscape(image)}">` : ''}
${publishedIso ? `<meta property="article:published_time" content="${attrEscape(publishedIso)}">` : ''}
${modifiedIso ? `<meta property="article:modified_time" content="${attrEscape(modifiedIso)}">` : ''}
<script type="application/ld+json">${safeSchema}</script>
<style>
:root{--cream:#f7efdf;--paper:#fffaf1;--maroon:#731f2f;--line:#d9c6ae;--text:#211b18}*{box-sizing:border-box}html,body{margin:0;background:var(--cream);color:var(--text);font-family:"Times New Roman",Times,serif}body{line-height:1.72}.top{background:var(--maroon);color:#fff8eb;text-align:center;padding:8px 16px}.container{width:min(920px,calc(100% - 36px));margin:auto}header{border-bottom:1px solid var(--line)}.head{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{text-decoration:none;color:#111}.brand strong{display:block;font-size:25px}.brand em{display:block;color:var(--maroon)}.home{display:inline-flex;padding:10px 17px;border-radius:999px;text-decoration:none;font-weight:700;background:var(--maroon);color:#fff}main{padding:48px 0 76px}.shell{background:var(--paper);border:1px solid var(--line);border-radius:22px;overflow:hidden}.cover{width:100%;max-height:520px;object-fit:cover}.body{padding:clamp(24px,5vw,54px)}h1{font-size:clamp(38px,7vw,66px);line-height:1.06;color:#000;margin:.1em 0 .35em}.meta{display:flex;gap:10px;flex-wrap:wrap;color:#6e5a50;margin-bottom:26px}.excerpt{color:var(--maroon);font-style:italic;font-size:21px;margin-bottom:28px}.content{font-size:20px;text-align:justify;overflow-wrap:anywhere;padding:8px 0;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='860' height='430' viewBox='0 0 860 430'%3E%3Ctext x='430' y='230' text-anchor='middle' transform='rotate(-24 430 230)' font-family='Times New Roman,serif' font-size='58' font-weight='700' fill='%23731f2f' fill-opacity='0.055'%3E%C2%A9%20PRAGYAH%20PRAVAAH%3C/text%3E%3C/svg%3E");background-repeat:repeat-y;background-position:center top;background-size:100% 430px}.content p{margin:0 0 1.15em}.content a{color:var(--maroon);font-weight:700}.author-box{margin-top:34px;padding:20px 22px;border:1px solid var(--line);border-radius:16px;background:#fffaf1}.author-box h2{margin:0 0 10px;color:var(--maroon);font-size:22px}.author-box p{margin:5px 0}.author-box a{color:var(--maroon);font-weight:700;text-decoration:none}.share-row{position:relative;display:flex;gap:12px;flex-wrap:wrap;margin-top:34px;padding-top:22px;border-top:1px solid var(--line)}.share{display:inline-flex;padding:10px 17px;border:1px solid var(--maroon);border-radius:999px;font:inherit;font-weight:700;background:var(--maroon);color:#fff;cursor:pointer}.share-menu{position:absolute;left:0;bottom:calc(100% + 10px);min-width:230px;padding:10px;background:var(--paper);border:1px solid var(--line);border-radius:16px;box-shadow:0 18px 45px rgba(73,40,24,.18);display:grid;gap:6px;z-index:10}.share-menu[hidden]{display:none}.share-option{display:block;width:100%;padding:10px 12px;border:0;border-radius:10px;background:transparent;color:var(--text);text-decoration:none;text-align:left;font:inherit;cursor:pointer}.share-option:hover{background:#f7ead6;color:var(--maroon)}.share-note{width:100%;margin:0;color:#6e5a50;font-size:14px;font-style:italic}.translate-wrap{display:flex;align-items:center;gap:9px;flex-wrap:wrap;width:100%}.translate-label{font-weight:700;color:var(--maroon)}.translate-select{min-height:44px;padding:9px 34px 9px 13px;border:1px solid var(--maroon);border-radius:999px;background:var(--paper);color:var(--text);font:inherit}.translation-note{width:100%;margin:2px 0 0;color:#6e5a50;font-size:14px;font-style:italic}footer{border-top:1px solid var(--line);padding:26px;text-align:center}@media(max-width:640px){.container{width:calc(100% - 28px)}.brand strong{font-size:20px}.brand em{font-size:12px}main{padding-top:26px}.body{padding:24px 20px}h1{font-size:38px}.content{font-size:18px}.excerpt{font-size:18px}}
</style>
</head>
<body>
<div class="top">A flow of wisdom • thoughtful words • something new every day</div>
<header><div class="container head"><a class="brand" href="${attrEscape(siteUrl)}/"><strong>Pragyah Pravaah</strong><em>A gentle flow of knowledge and thought</em></a><a class="home" href="${attrEscape(siteUrl)}/">← Home</a></div></header>
<main class="container"><article class="shell">${coverMarkup}<div class="body"><h1>${htmlEscape(title)}</h1><div class="meta">${dateMarkup}<span>${readTime}</span></div><div class="excerpt">${htmlEscape(article.excerpt || '')}</div><div class="content" id="articleContent">${content}</div>${authorMarkup}<div class="share-row"><div class="translate-wrap"><label class="translate-label" for="translateLanguage">🌐 Translate article:</label><select id="translateLanguage" class="translate-select"><option value="">Choose language</option><option value="hi">Hindi</option><option value="pa">Punjabi</option><option value="bn">Bengali</option><option value="mr">Marathi</option><option value="gu">Gujarati</option><option value="ta">Tamil</option><option value="te">Telugu</option><option value="ur">Urdu</option><option value="fr">French</option><option value="de">German</option><option value="es">Spanish</option><option value="ja">Japanese</option><option value="ar">Arabic</option></select><p class="translation-note">The article was originally published in English. Machine translation may slightly change some words or meanings.</p></div><button id="shareToggle" class="share" type="button">Share article</button><div id="shareMenu" class="share-menu" hidden><a id="wa" class="share-option" target="_blank" rel="noopener">WhatsApp</a><a id="tg" class="share-option" target="_blank" rel="noopener">Telegram</a><a id="fb" class="share-option" target="_blank" rel="noopener">Facebook</a><button id="ig" class="share-option" type="button">Instagram</button><button id="copy" class="share-option" type="button">Copy link</button></div><p id="shareNote" class="share-note" hidden></p></div></div></article></main>
<footer>© <span id="year"></span> Pragyah Pravaah. All rights reserved.</footer>
<script>
const canonical=${JSON.stringify(canonical)};const articleTitle=${JSON.stringify(title)};
document.getElementById('year').textContent=new Date().getFullYear();
const translateLanguage=document.getElementById('translateLanguage');translateLanguage.addEventListener('change',()=>{if(!translateLanguage.value)return;window.open('https://translate.google.com/translate?sl=auto&tl='+encodeURIComponent(translateLanguage.value)+'&u='+encodeURIComponent(canonical),'_blank','noopener')});
const shareToggle=document.getElementById('shareToggle'),shareMenu=document.getElementById('shareMenu'),shareNote=document.getElementById('shareNote');shareToggle.addEventListener('click',()=>{shareMenu.hidden=!shareMenu.hidden});document.addEventListener('click',e=>{if(!e.target.closest('.share-row'))shareMenu.hidden=true});const copyLink=async()=>{try{await navigator.clipboard.writeText(canonical);shareNote.textContent='Article link copied.';shareNote.hidden=false;setTimeout(()=>shareNote.hidden=true,2500)}catch{prompt('Copy this link:',canonical)}};document.getElementById('copy').addEventListener('click',copyLink);document.getElementById('wa').href='https://wa.me/?text='+encodeURIComponent(articleTitle+' '+canonical);document.getElementById('tg').href='https://t.me/share/url?url='+encodeURIComponent(canonical)+'&text='+encodeURIComponent(articleTitle);document.getElementById('fb').href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(canonical);document.getElementById('ig').addEventListener('click',async()=>{await copyLink();shareNote.textContent='Link copied. Paste it into your Instagram story, bio or message.';shareNote.hidden=false;window.open('https://www.instagram.com/','_blank','noopener')});
</script>
</body></html>`;

    return response(200, html, { 'Link': `<${canonical}>; rel="canonical"` });
  } catch (error) {
    console.error('Dynamic article rendering failed:', error);
    return errorPage({ siteUrl, title: 'Unable to load article', message: 'The article could not be loaded right now. Please try again shortly.', statusCode: 500 });
  }
};
