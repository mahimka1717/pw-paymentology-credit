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
