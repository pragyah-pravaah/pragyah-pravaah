PRAGYAH PRAVAAH — NETLIFY DYNAMIC ARTICLE VERSION

1. Do not deploy this package with `firebase deploy`.
2. Upload the entire folder/ZIP to the existing Netlify site.
3. Keep all files together, especially:
   - index.html
   - article.html
   - _redirects
   - netlify.toml
   - netlify/functions/sitemap.js
4. Netlify rewrites `/articles/<id>/<slug>` to article.html, so each article opens as a separate shareable page.
5. After deployment, hard-refresh the site.
