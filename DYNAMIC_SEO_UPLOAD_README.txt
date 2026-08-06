PRAGYAH PRAVAAH — DYNAMIC SEO FIX

IMPORTANT: Upload ALL files from this folder to the ROOT of the existing GitHub repository.
The following root files are essential and must show the new commit time on GitHub:
- netlify.toml
- _redirects
- article.js
- sitemap.js
- index.html
- article.html

This package intentionally keeps article.js and sitemap.js in the repository root so they can be uploaded through GitHub's Upload files page without creating nested folders.

After commit, check the Netlify deploy log. It should mention that 2 functions were bundled/deployed.
Then test:
1. https://pragyahpravaah.netlify.app/sitemap.xml
2. Open an article URL under /articles/...
