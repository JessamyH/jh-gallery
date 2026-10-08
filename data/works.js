// ==========================================================================
// JH Gallery — content
// This is the only file you need to edit to add, change or remove works.
//
// One entry = one record on the timeline (a performance, a session, a shoot).
// A record can hold several photos and videos; they are browsed together.
//
//   id          Unique, URL-safe slug. Used in links like index.html#/my-id
//   title       Short title shown on the card and in the viewer.
//   date        When it was FILMED / PHOTOGRAPHED (not when uploaded).
//               "2025"         → year only
//               "2025-11"      → year + month
//               "2025-11-14"   → full date
//               Newest first; within a year, less precise dates sort last.
//   description One or two sentences of background. Optional.
//   location    Optional.
//   tags        Any of e.g. "Dance", "Singing", "Piano", "Photo", "Video".
//               Several are fine: ["Piano", "Singing"]. Optional.
//   cover       Image used on the timeline card. Optional — defaults to the
//               first photo, or the first video's poster.
//   featured    true → shown as the opening piece at the top of the page.
//               If several are featured, the newest one is used.
//   uploadedAt  Kept for your own records; not shown on the site. Optional.
//   sample      true → marks placeholder content with a "Sample" badge.
//               Delete the sample records once you add your own.
//   media       List of items, shown in this order in the viewer:
//                 { type: "image", src: "media/...jpg", alt: "..." }
//                 { type: "video", src: "media/...mp4", poster: "media/...jpg" }
//               Videos never autoplay; the poster is shown until the visitor
//               presses play. Aspect ratios are read from the files — nothing
//               is cropped.
//
// Put your files in the media/ folder (any sub-folders you like).
// ==========================================================================

window.GALLERY = {
  siteTitle: "JH Gallery",
  tagline: "Life in motion. Moments in light.",

  works: [
    {
      id: "sample-stage-evening",
      title: "Sample — Stage Evening",
      date: "2026-05",
      location: "Sample venue",
      tags: ["Dance"],
      description:
        "Placeholder record to preview a multi-photo performance with a clip. Replace with your own work.",
      cover: "media/samples/stage-wide.jpg",
      featured: true,
      uploadedAt: "2026-10-08",
      sample: true,
      media: [
        { type: "image", src: "media/samples/stage-wide.jpg", alt: "Sample stage photo, wide" },
        { type: "image", src: "media/samples/stage-tall.jpg", alt: "Sample stage photo, tall" },
        { type: "video", src: "media/samples/clip-wide.mp4", poster: "media/samples/clip-wide-poster.jpg" },
        { type: "image", src: "media/samples/stage-cinema.jpg", alt: "Sample stage photo, 16:9" },
      ],
    },
    {
      id: "sample-piano-and-voice",
      title: "Sample — Piano & Voice",
      date: "2026-02-21",
      tags: ["Piano", "Singing"],
      description: "Placeholder for a single video record with two tags.",
      uploadedAt: "2026-10-08",
      sample: true,
      media: [
        { type: "video", src: "media/samples/clip-wide.mp4", poster: "media/samples/piano-wide.jpg" },
      ],
    },
    {
      id: "sample-portraits",
      title: "Sample — Portraits",
      date: "2025-09-14",
      tags: ["Photo"],
      description: "Placeholder for a small photo set in portrait orientation.",
      uploadedAt: "2026-10-08",
      sample: true,
      media: [
        { type: "image", src: "media/samples/portrait-a.jpg", alt: "Sample portrait, 4:5" },
        { type: "image", src: "media/samples/portrait-b.jpg", alt: "Sample portrait, 2:3" },
      ],
    },
    {
      id: "sample-rehearsal-clip",
      title: "Sample — Rehearsal Clip",
      date: "2025-03",
      tags: ["Dance"],
      description: "Placeholder for a vertical phone video.",
      uploadedAt: "2026-10-08",
      sample: true,
      media: [
        { type: "video", src: "media/samples/clip-vertical.mp4", poster: "media/samples/clip-vertical-poster.jpg" },
      ],
    },
    {
      id: "sample-afternoon-light",
      title: "Sample — Afternoon Light",
      date: "2025",
      tags: ["Photo"],
      description: "Placeholder with a year-only date.",
      uploadedAt: "2026-10-08",
      sample: true,
      media: [
        { type: "image", src: "media/samples/light-square.jpg", alt: "Sample square photo" },
      ],
    },
    {
      id: "sample-early-piece",
      title: "Sample — An Early Piece",
      date: "2023-12",
      tags: ["Piano"],
      description: "Placeholder for an older record, to show an earlier year.",
      uploadedAt: "2026-10-08",
      sample: true,
      media: [
        { type: "image", src: "media/samples/piano-wide.jpg", alt: "Sample piano stage photo" },
      ],
    },
  ],
};
