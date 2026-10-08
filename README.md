# JH Gallery

A personal gallery: life in motion, moments in light. Works are arranged by **when they were filmed or photographed**, grouped by year with the newest first.

A static site built with plain HTML, CSS and vanilla JavaScript. It has no frameworks, build step or dependencies (Google Fonts is optional and falls back to Georgia when offline).

## Run locally

Open `index.html` in a browser.

## Structure

```
jh-gallery/
├── index.html        # Page shell + viewer dialog
├── styles.css        # Look & feel; colours in :root (warm dark, ivory, a little dark red)
├── script.js         # Renders the opening, the year chapters and the viewer
├── data/
│   └── works.js      # ← ALL content lives here
└── media/
    └── samples/      # Placeholder media (safe to delete once replaced)
```

## Adding a work

1. Put the photos and videos in `media/`. A folder per work is a good habit, for example `media/2025-spring-recital/`.
2. Add a record to the `works` list in `data/works.js`:

```js
{
  id: "2025-spring-recital",
  title: "Spring Recital",
  date: "2025-04",                 // "2025" | "2025-04" | "2025-04-12" (when it was filmed)
  location: "Sydney",              // optional
  tags: ["Piano", "Singing"],      // optional, any number
  description: "One or two lines of background.",
  cover: "media/2025-spring-recital/01.jpg",   // optional; defaults to the first photo / video poster
  featured: true,                  // optional; shows it as the opening piece
  uploadedAt: "2026-10-08",        // optional; for your records only, not shown
  media: [
    { type: "image", src: "media/2025-spring-recital/01.jpg", alt: "On stage" },
    { type: "video", src: "media/2025-spring-recital/song.mp4", poster: "media/2025-spring-recital/song.jpg" },
  ],
},
```

The order in the file doesn't matter, because the site sorts by `date`. Records with only a year sort after the dated ones in that year.

3. Delete the `sample-…` records and `media/samples/` once you have your own content.

## Media tips

- **Photos:** JPG/WebP, about 2000–2500 px on the long edge, keeps pages fast.
- **Videos:** MP4 (H.264 + AAC) plays everywhere. Always give a `poster` image, because that is what the card and the viewer show before the visitor presses play. Videos never autoplay.
- Aspect ratios are read from the files and nothing is cropped, so portrait, landscape and phone-vertical media all work.
- Layout is automatic, like hanging a museum room: each year is a room, and every work is framed with a small wall label. Its size comes from its orientation and a repeating large / small rhythm; works share an eye line, and a work hung on its own is centred. The featured work (or the newest, if none is marked) opens the page under the collection title.
- After editing `styles.css` or `script.js`, bump the `?v=` number on the links in `index.html` so browsers fetch the new files.

## Status

🚧 Work in progress — the layout and viewer are done, shown with placeholder samples for now.

- **Now:** public browsing only. Content is edited in `data/works.js`; there is no upload UI, login, comments or likes.
- **Next:** replace the samples with real works, decide where photos and videos are hosted, then deploy.
