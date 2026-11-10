# TryMetaClear — Project Overview

Analysis of the `trymetaclear` repository as of 2026-11-10.

## 1. What it is

TryMetaClear (https://trymetaclear.com) is a free web tool. It finds and removes hidden metadata from images and videos:

- EXIF, IPTC and XMP data
- GPS location
- C2PA Content Credentials
- AI-generator data (prompts, seeds and model names from Midjourney, DALL-E, Stable Diffusion, Sora, Runway and similar tools)

One tool, the Gemini page, also removes the visible Gemini watermark from the corner of an image.

The site is also built to bring in search traffic. Each AI tool has its own landing page with long-form text, FAQ schema, and Open Graph and Twitter tags.

## 2. Tech stack

| Layer | What's used |
|---|---|
| Pages | Plain static HTML. No build step, no framework, no `package.json` |
| Styling | Tailwind CSS from the Play CDN (`cdn.tailwindcss.com`), set up inline on each page. The Gemini page also has its own CSS |
| Scripts | Vanilla JavaScript, inline in each page |
| Backend | A separate API at `https://api.trymetaclear.com`. Its code is **not in this repo**. The site text says it uses ExifTool |
| Analytics | Google Tag Manager `GTM-PXHMQC7T` |
| Hosting | Netlify, judging by the CSS that hides the Netlify badge. Clean URLs such as `/remove-midjourney-metadata` are served from `remove-midjourney-metadata.html` |

## 3. File map

```
index.html                            Home page: main image metadata remover
remove-ai-metadata-from-image.html    Landing page: general AI metadata (images)
remove-c2pa-content-credentials.html  Landing page: C2PA / Content Credentials
remove-dall-e-metadata.html           Landing page: DALL-E 3
remove-midjourney-metadata.html       Landing page: Midjourney
remove-video-ai-metadata.html         Video tool (MP4 / MOV / WebM)
remove-gemini-ai-watermark.html       Visible-watermark remover, runs entirely in the browser
about.html  contact.html              Company pages
privacy.html  terms.html              Legal pages
robots.txt  sitemap.xml               Search crawler files
Logo.png  favico.png  og-image.png    Images
```

There is no shared header or footer file. Every page carries its own copy of the header, nav, footer and Tailwind config.

## 4. How the tools work

### 4.1 Server-backed tools (images and video)

The home page, the four image landing pages and the video page all work the same way:

1. The user drops or picks a file. Images are limited to 100 MB (`accept="image/*"`). Video is limited to 100 MB as MP4, MOV or WebM.
2. **Scan:** the page sends the file as `multipart/form-data` (field `file`) to `POST https://api.trymetaclear.com/api/v1/scan`. While it waits, it shows a progress bar that isn't tied to real progress.
3. The page shows the JSON reply:
   - `has_ai` (boolean) sets the status card to "AI Footprints Found" or "No AI Metadata Detected".
   - `detected_model`, `total_fields` and `ai_count` fill in the summary figures.
   - `sections` is a list of groups, each holding fields shaped like `{ key|tag|name, value, is_ai }`. Each group becomes a collapsible table.
   - The video page also accepts `ai_tags_count`, `detected_ai`, `ai_model`, and a flat `tags` list.
4. **Clean:** the same file is sent again to `POST /api/v1/clean`. The reply is the cleaned file, which downloads as `cleared_<original name>`.
5. Each download sends a `file_download` event to GTM through `dataLayer`, except on the video page.

### 4.2 Gemini watermark remover (no server)

`remove-gemini-ai-watermark.html` runs entirely in the browser and never uploads the file.

- **Loading:** it accepts PNG, JPG or WebP files up to 40 MB and 40 megapixels, from drag-and-drop, the file picker or paste. If one way of decoding the image fails, it tries the next: `createImageBitmap`, then a data URL, then a blob URL.
- **Detection:** it looks in the bottom-right 28 % of the image for bright areas that stand out from their surroundings. It keeps shapes of a plausible size and proportion and picks the one closest to the corner, then grows that shape slightly to make the mask. The Sensitivity slider (1–10) sets how strong the contrast must be. If nothing is found, it retries twice with a lower bar.
- **Inpainting:** it fills the masked area from the edges inward, using a weighted average of nearby pixels. It then adds a little noise matched to the image's own grain, so the patch doesn't look unnaturally smooth.
- **Manual brush:** the user can paint over leftover marks on an overlay canvas, and those areas are filled the same way.
- **Export:** PNG or JPEG at quality 0.95. The file is rebuilt from the canvas, so it carries no metadata.

## 5. SEO setup

- Each tool page has its own title, meta description, canonical link, Open Graph and Twitter tags, and JSON-LD schema (`WebApplication` and `FAQPage`).
- The home page has a long text section, marked in the code as the "1,500+ word SEO content engine".
- `robots.txt` allows all crawlers and points to the sitemap.
- `sitemap.xml` lists 7 URLs (see the issues below).

## 6. Issues found

These come from reading the code, not from testing in a browser. They are grouped by impact.

### High: broken features or broken SEO

1. **The home page never shows scan results.** In `index.html`, `renderResults()` only un-hides the results box. It never fills in the status, summary figures or metadata tables, so visitors see empty cards. The home page also lacks the scanning progress bar that the landing pages have. The full version of `renderResults` in `remove-c2pa-content-credentials.html` should be copied over.
2. **The DALL-E page's canonical link is broken.** `remove-dall-e-metadata.html` line 17 contains `href="[https://...](https://...)"`, a Markdown link pasted into the HTML, so search engines get an invalid canonical URL.
3. **The logo may not load.** Pages use `src="logo.png"`, but the file is named `Logo.png`. Windows ignores the difference, but Netlify's servers treat file names as case-sensitive, so the logo is likely missing on the live site. The path is also relative rather than `/logo.png`, so it would break on any page in a subfolder, such as a future `/blog/`.
4. **The Blog links lead nowhere.** `/blog/` is linked from the home page header and footer, but no blog exists in the repo.
5. **The sitemap is incomplete and inconsistent.**
   - Missing pages: `remove-ai-metadata-from-image`, `remove-dall-e-metadata`, `remove-gemini-ai-watermark` and `contact`.
   - Some URLs end in `.html` (about, privacy, terms) and others don't.

### Medium: correctness and consistency

6. **Leftover broken download function.** Four pages declare `downloadCleanedImage()` twice: ai-metadata, c2pa, dall-e and midjourney. The first copy is cut off and ends with `...currentUploadedFile);}`. The page still works, because the second copy replaces the first, but the first copy should be deleted.
7. **The video page reports "Clean" when the scan fails.** If `/scan` errors, `renderFallbackVideoResults()` shows made-up tags and "None Detected (Clean)". The user is told their file is clean when it was never checked.
8. **Wrong fallback model on the DALL-E page.** It shows `"Midjourney / AI"` when the API returns no `detected_model`. This was copied from the Midjourney page.
9. **The analytics setup is non-standard and missing on some pages.**
   - The GTM tag loads `gtm.js` directly but never pushes the standard `{'gtm.start', event:'gtm.js'}` entry. Tags set to fire on "All Pages" may never fire. The standard GTM snippet should be used instead.
   - GTM is missing entirely from the video, Gemini, about, contact, privacy and terms pages.
10. **The privacy policy doesn't match the site.**
    - It mentions Microsoft Clarity and GA4, but only GTM appears in the code.
    - It lists "PNG, JPG, WebM" as image formats; WebM is a video format.
    - It says all files are processed on a server, but the Gemini tool runs entirely in the browser.
11. **The Gemini page is missing standard page tags.** It has no canonical link, no favicon, no `og:image` and no Twitter tags. Its nav calls it "Gemini AI Metadata Remover", which doesn't match what the tool does (watermark removal).
12. **The video page points to the wrong favicon.** It references `/favicon.png`, but the file is `favico.png`.
13. **The nav is different on every page.** The home page Tools menu omits the Gemini, DALL-E and general AI metadata pages. Some pages link Blog, some link Contact, and some link neither.

### Low: polish, performance and security

14. **`og-image.png` is 6.5 MB.** Social sites expect a preview image well under 1 MB. It should be compressed or converted to JPG or WebP. `Logo.png` is 430 KB for an image shown at 64 px tall.
15. **The Tailwind Play CDN is a development tool.** Tailwind warns against using it on a live site: it builds the CSS in the visitor's browser on every page load. A prebuilt CSS file would load faster.
16. **Unescaped text is inserted into the page.** Metadata values from the API and the uploaded file's name go straight into `innerHTML`. Anyone who can control metadata in a file could inject HTML. The risk is mostly to the person uploading that file, but it's easy to fix with `textContent` or an escaping helper. In the video page, `toggleSection('${sectionName}')` will also break if a section name contains a quote.
17. **Copy issues.**
    - The home page heading says "UnPaid AI Metadata Remover".
    - The site claims "bulk batches" are processed, but every tool takes one file at a time.
    - The home page drop zone says HEIC is supported, while the other image pages only mention PNG, JPG and WebP.
18. **Duplicated code.** The header, footer, Tailwind config and upload script are copied across 6–11 pages. Every fix has to be repeated on every page. This is how issues 1, 6, 9 and 13 came about.

## 7. Suggested next steps

1. Fix the high-impact issues (1–5). Each is a small edit.
2. Clean up the scripts on the image pages: remove the duplicate function, copy the full `renderResults` to the home page, and escape inserted text.
3. Standardise the header, footer, GTM snippet and nav on every page. Longer term, share them through a small build step such as Eleventy or Astro, or a single included script.
4. Compress the images and switch from the Tailwind CDN to a prebuilt CSS file.
5. Update the sitemap and privacy policy to match the actual pages and analytics.

## 8. Development notes

- **Running locally:** open the HTML files directly, or run any static server from the repo folder. The image and video tools need `api.trymetaclear.com` to be reachable and to allow requests from your local address. The Gemini tool works offline.
- **Deploying:** pushing to `main` probably triggers a Netlify deploy. The repo has no Netlify config file, so this is set up in the Netlify dashboard.
- **Commit history:** messages are mostly "test" or "testing". More descriptive messages would make it much easier to find when a bug was introduced.
