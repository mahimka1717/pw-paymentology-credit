# Handoff notes

Open items to finish before the article goes live.

## Open items

### "Read more" link has no destination

The call-to-action button at the end of the article points nowhere:

```html
<!-- index.html, end of .main -->
<a class="read-more" href="#">Read more <span aria-hidden="true">→</span></a>
```

The target URL was not available when the page was built. JS (`initReadMore` in `js/article.js`) only animates the button and does not set the link.

**To do:** replace `href="#"` with the real URL. If it opens another site, add `target="_blank" rel="noopener"` if it should open in a new tab. Then run `npm run build`.

### Search indexing is blocked on the Vercel preview

The Vercel deployment is a preview only, so it is hidden from search engines in two ways:

- `robots.txt` contains `Disallow: /` and is copied into `dist/` by the build (`scripts/minify.mjs`).
- `vercel.json` sends `X-Robots-Tag: noindex, nofollow` on every response.

`index.html` itself has no `noindex` meta tag, so the page markup can be reused as is.

**To do when hosting on the hub:** do not carry over the `Disallow: /` rule or the `X-Robots-Tag` header to the production site.

### Social card image, og:url and canonical need the final URL

`index.html` already has `og:type`, `og:site_name`, `og:title`, `og:description` and `twitter:card`. The tags that need an absolute URL were left out because the final address is not known yet.

The card image is ready: `public/img/og.jpg`, 1200×630.

**To do:** add these to `<head>` with the real address of the article:

```html
<link rel="canonical" href="https://EXAMPLE.COM/ARTICLE-PATH" />
<meta property="og:url" content="https://EXAMPLE.COM/ARTICLE-PATH" />
<meta property="og:image" content="https://EXAMPLE.COM/ARTICLE-PATH/public/img/og.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Glowing world map on a purple background" />
```

### No favicon

The page does not reference a favicon, so browsers request `/favicon.ico` and get a 404. There is no suitable brand icon in the repo.

**To do:** add the hub's favicon, for example:

```html
<link rel="icon" href="/favicon.ico" sizes="32x32" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```
