PRAGYAH PRAVAAH — DYNAMIC SEO UPDATE

This package was created from the uploaded stable project.
The existing index.html and article data workflow were not redesigned.

Dynamic SEO changes added:
1. netlify/functions/article.js
   - Server-renders each public article at /articles/ARTICLE-ID/article-slug
   - Unique HTML title and meta description
   - Canonical URL
   - Open Graph and Twitter sharing tags
   - Article JSON-LD structured data
   - Per-article author name/email when present
   - Excludes drafts and future scheduled posts

2. netlify/functions/sitemap.js
   - Automatically lists all currently published articles
   - Excludes drafts and future scheduled posts
   - Adds last-modified dates when available

3. _redirects
   - Routes article URLs to the dynamic Netlify function
   - Routes /sitemap.xml to the dynamic sitemap function

4. netlify.toml
   - Netlify Functions configuration and safe headers

DEPLOYMENT
- Extract this ZIP.
- Upload all extracted files to the existing GitHub repository root.
- Commit directly to main.
- Netlify will deploy automatically.

Suggested commit message:
Add server-rendered dynamic SEO article pages

AFTER DEPLOYMENT — TEST
1. Open the homepage.
2. Click an article title/image/Read article.
3. Confirm the URL is /articles/ARTICLE-ID/article-slug.
4. Copy that URL into a private/incognito window; the same article should open.
5. Open https://pragyahpravaah.netlify.app/sitemap.xml and confirm article URLs appear.

GOOGLE SEARCH CONSOLE
- Submit sitemap.xml once under Sitemaps.
- For a newly published article, URL Inspection > paste the article URL > Request indexing is optional.
- Google indexing is not instant or guaranteed, but this setup gives each article a crawlable, server-rendered SEO page.
