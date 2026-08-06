const PROJECT_ID = 'pragyah-pravaah';
const DEFAULT_SITE_URL = 'https://pragyahpravaah.netlify.app';

function fieldValue(field) {
  if (!field) return '';
  return field.stringValue ?? field.timestampValue ?? field.integerValue ?? field.doubleValue ?? '';
}

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

exports.handler = async function (event) {
  const host = event.headers?.['x-forwarded-host'] || event.headers?.host;
  const proto = event.headers?.['x-forwarded-proto'] || 'https';
  const siteUrl = process.env.SITE_URL || (host ? `${proto}://${host}` : DEFAULT_SITE_URL);

  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/articles?pageSize=1000`;
    const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Firestore returned ${response.status}`);

    const data = await response.json();
    const entries = (data.documents || []).flatMap((document) => {
      const fields = document.fields || {};
      const status = String(fieldValue(fields.status) || 'published').toLowerCase();
      if (status !== 'published') return [];
      const publishAt = fieldValue(fields.publishAt);
      if (publishAt && new Date(publishAt).getTime() > Date.now()) return [];

      const id = decodeURIComponent(document.name.split('/').pop());
      const title = fieldValue(fields.title);
      const slug = fieldValue(fields.slug) || slugify(title);
      const modified = fieldValue(fields.updatedAt) || fieldValue(fields.dateModified) || fieldValue(fields.date) || fieldValue(fields.createdAt);
      const loc = `${siteUrl}/articles/${encodeURIComponent(id)}/${encodeURIComponent(slug)}`;
      return [{ loc, modified }];
    });

    const urls = [
      `  <url>\n    <loc>${xmlEscape(siteUrl)}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
      ...entries.map(({ loc, modified }) => {
        const parsed = modified ? new Date(modified) : null;
        const lastmod = parsed && !Number.isNaN(parsed.getTime()) ? `\n    <lastmod>${parsed.toISOString().slice(0, 10)}</lastmod>` : '';
        return `  <url>\n    <loc>${xmlEscape(loc)}</loc>${lastmod}\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
      })
    ].join('\n');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=1800',
        'X-Robots-Tag': 'noindex'
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
    };
  } catch (error) {
    console.error('Sitemap generation failed:', error);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
      body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${xmlEscape(siteUrl)}/</loc></url>\n</urlset>`
    };
  }
};
