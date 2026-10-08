// JH Gallery — renders data/works.js into the page and runs the viewer.
// Content lives in data/works.js; nothing in this file needs editing to add works.

(() => {
  const data = window.GALLERY || { works: [] };
  const $ = (id) => document.getElementById(id);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';

  // ---------- Dates: "2025", "2025-11" or "2025-11-14" ----------

  function parseDate(str) {
    const [y, m, d] = String(str || "").split("-").map(Number);
    return { year: y || 0, month: m || 0, day: d || 0 };
  }

  function formatDate(str) {
    const { year, month, day } = parseDate(str);
    if (!year) return "";
    if (!month) return String(year);
    if (!day) return `${MONTHS[month - 1]} ${year}`;
    return `${day} ${MONTHS[month - 1]} ${year}`;
  }

  // Newest first. Within a year, undated months/days sort after dated ones.
  function compareWorks(a, b) {
    const da = parseDate(a.date), db = parseDate(b.date);
    return (db.year - da.year) || (db.month - da.month) || (db.day - da.day);
  }

  const coverOf = (w) =>
    w.cover || (w.media || []).map((m) => (m.type === "video" ? m.poster : m.src)).find(Boolean) || "";

  const thumbOf = (m) => (m.type === "video" ? m.poster : m.src);

  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const metaLine = (w) => [formatDate(w.date), w.location].filter(Boolean).map(escapeHtml).join(" · ");

  // "3 photos · 1 film", "Dance / Singing"
  function contentsLine(w) {
    const media = w.media || [];
    const photos = media.filter((m) => m.type !== "video").length;
    const films = media.length - photos;
    const parts = [];
    if (photos > 1 || (photos && films)) parts.push(`${photos} photo${photos > 1 ? "s" : ""}`);
    if (films) parts.push(`${films} film${films > 1 ? "s" : ""}`);
    return parts.join(" · ");
  }
  const tagsLine = (w) => (w.tags || []).map(escapeHtml).join(" / ");

  // Learn each cover's real proportions, so the layout never crops.
  function loadRatio(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(1.5);
      const img = new Image();
      const done = (r) => { clearTimeout(timer); resolve(r); };
      const timer = setTimeout(() => done(1.5), 8000);
      img.onload = () => done(img.naturalWidth / img.naturalHeight || 1.5);
      img.onerror = () => done(1.5);
      img.src = src;
    });
  }

  const works = (data.works || []).filter((w) => w && w.id).slice().sort(compareWorks);
  const byId = new Map(works.map((w) => [w.id, w]));

  $("year").textContent = new Date().getFullYear();
  if (data.siteTitle) document.title = data.siteTitle;

  // ---------- Opening: featured work, then the site name as a wall label ----------

  const featured = works.find((w) => w.featured) || works[0];
  const opening = $("opening");
  opening.innerHTML = `
    ${featured ? `
      <div class="opening-media">
        <a href="#/${encodeURIComponent(featured.id)}" aria-label="Open ${escapeHtml(featured.title)}">
          <img src="${escapeHtml(coverOf(featured))}" alt="" fetchpriority="high">
        </a>
      </div>` : ""}
    <div class="frame opening-text">
      <div>
        <h1 class="site-title">${escapeHtml(data.siteTitle || "JH Gallery")}</h1>
        ${data.tagline ? `<p class="tagline">${escapeHtml(data.tagline)}</p>` : ""}
      </div>
      ${featured ? `
        <a class="opening-label" href="#/${encodeURIComponent(featured.id)}">
          <span class="note">${featured.sample ? '<span style="color:var(--red-ink)">Sample</span> · ' : ""}${metaLine(featured)}</span>
          <span class="work-title">${escapeHtml(featured.title)}</span>
          <span class="note go">View work</span>
        </a>` : ""}
    </div>`;

  // ---------- Gallery wall layout ----------
  // A repeating rhythm of rows. Each work's width depends on its orientation
  // and its slot (L / M / S), so portraits stay narrow and landscapes wide.

  const orient = (r) => (r >= 1.2 ? "land" : r <= 0.85 ? "port" : "sq");
  const PAIR = { land: { L: 6, S: 4 }, sq: { L: 5, S: 3 }, port: { L: 4, S: 3 } };
  const SOLO = { land: { L: 8, M: 6 }, sq: { L: 5, M: 4 }, port: { L: 4, M: 3 } };
  const RHYTHM = [["L", "S"], ["M"], ["S", "L"], ["L"]];

  function planChapter(items) {
    const out = [];
    let i = 0, beat = 0;
    while (i < items.length) {
      const row = RHYTHM[beat++ % RHYTHM.length];
      const a = items[i], b = items[i + 1];
      if (row.length === 2 && b) {
        const sa = PAIR[orient(a.ratio)][row[0]];
        const sb = PAIR[orient(b.ratio)][row[1]];
        if (sa + sb <= 11) {
          out.push({ ...a, start: 1, span: sa, drop: row[0] === "S" });
          out.push({ ...b, start: 13 - sb, span: sb, drop: row[1] === "S", end: true });
          i += 2;
          continue;
        }
      }
      const size = row.length === 2 ? "L" : row[0];
      const span = SOLO[orient(a.ratio)][size];
      // Large solos sit centred; medium solos lean right for an off-beat.
      const start = size === "L" ? Math.floor((12 - span) / 2) + 1 : 12 - span;
      out.push({ ...a, start, span, drop: false });
      i += 1;
    }
    return out;
  }

  function plateHtml(p, n, mobileIndex) {
    const w = p.work;
    const o = orient(p.ratio);
    const cls = ["plate", "reveal", p.end && "is-end", p.drop && "is-drop",
      o !== "land" && `m-${o}`, o !== "land" && mobileIndex % 2 && "m-right"].filter(Boolean).join(" ");
    const extra = [contentsLine(w), tagsLine(w)].filter(Boolean).join(" — ");
    return `
      <a class="${cls}" href="#/${encodeURIComponent(w.id)}" style="--start:${p.start};--span:${p.span}">
        <img src="${escapeHtml(coverOf(w))}" alt="" loading="lazy" decoding="async">
        <div class="plate-caption">
          <p class="plate-meta note">
            <span class="no">${String(n).padStart(2, "0")}</span>
            <span>${escapeHtml(formatDate(w.date))}</span>
            ${w.sample ? '<span class="sample">Sample</span>' : ""}
          </p>
          <h3 class="plate-title">${escapeHtml(w.title)}</h3>
          ${extra ? `<p class="plate-extra">${extra}</p>` : ""}
        </div>
      </a>`;
  }

  async function renderTimeline() {
    const timeline = $("timeline");
    if (!works.length) {
      timeline.innerHTML = '<p class="frame empty">No works yet — add some in data/works.js.</p>';
      return;
    }
    const ratios = await Promise.all(works.map((w) => loadRatio(coverOf(w))));
    const items = works.map((work, i) => ({ work, ratio: ratios[i] }));

    const years = [];
    const groups = new Map();
    for (const it of items) {
      const y = parseDate(it.work.date).year || "Undated";
      if (!groups.has(y)) { groups.set(y, []); years.push(y); }
      groups.get(y).push(it);
    }

    timeline.innerHTML = years.map((y) => {
      const list = groups.get(y);
      let nonLand = 0;
      const plates = planChapter(list).map((p, n) =>
        plateHtml(p, n + 1, orient(p.ratio) === "land" ? 0 : nonLand++)).join("");
      return `
        <section class="chapter frame" id="y-${y}" aria-labelledby="y-${y}-h">
          <header class="chapter-head reveal">
            <h2 id="y-${y}-h">${y}</h2>
            <span class="note">${list.length} ${list.length === 1 ? "work" : "works"}</span>
          </header>
          <div class="plates">${plates}</div>
        </section>`;
    }).join("");

    renderYearNav(years, groups);
    observeReveals();

    // Year sections exist only now, so jump to #y-2025 style links ourselves.
    const target = /^#y-/.test(location.hash) && document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ behavior: "instant" });
  }

  // ---------- Year navigation ----------
  // Only the most recent years sit in the header (4 on desktop, 2 on phones);
  // "All years" opens a compact index of every year, so it never overflows.

  const RECENT_YEARS = 4;

  function renderYearNav(years, groups) {
    const nav = $("year-nav");
    nav.classList.toggle("has-more", years.length > RECENT_YEARS);
    nav.classList.toggle("has-index", years.length > 2);
    nav.innerHTML = `
      <div class="year-links">
        ${years.slice(0, RECENT_YEARS).map((y) => `<a class="note" href="#y-${y}">${y}</a>`).join("")}
      </div>
      <button class="year-toggle note" type="button" aria-expanded="false" aria-controls="year-index">All years</button>
      <div class="year-index" id="year-index" hidden>
        ${years.map((y) => `
          <a href="#y-${y}">
            <span class="year-index-y">${y}</span>
            <span class="note">${groups.get(y).length}</span>
          </a>`).join("")}
      </div>`;

    const toggle = nav.querySelector(".year-toggle");
    const panel = nav.querySelector(".year-index");
    const setOpen = (open) => {
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    };
    toggle.addEventListener("click", (e) => { e.stopPropagation(); setOpen(panel.hidden); });
    panel.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("click", (e) => { if (!panel.hidden && !nav.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) { setOpen(false); toggle.focus(); }
    });
  }

  // ---------- Gentle reveal on scroll ----------

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const io = "IntersectionObserver" in window && !reducedMotion
    ? new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      }, { rootMargin: "0px 0px -6% 0px" })
    : null;

  function observeReveals() {
    document.querySelectorAll(".reveal:not(.is-in)").forEach((el) => (io ? io.observe(el) : el.classList.add("is-in")));
  }

  const masthead = $("masthead");
  const onScroll = () => masthead.classList.toggle("is-solid", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  renderTimeline();

  // ==========================================================================
  // Viewer — opened via #/<work-id>, so links are shareable and the
  // browser/phone back button closes it.
  // ==========================================================================

  const viewer = $("viewer");
  const frames = $("viewer-frames");
  const state = { work: null, index: 0, openedHere: false };

  function openWork(work, index = 0) {
    state.work = work;
    $("viewer-title").textContent = work.title;
    $("viewer-meta").innerHTML =
      (work.sample ? '<span style="color:var(--red-ink)">Sample</span> · ' : "") +
      [metaLine(work), tagsLine(work)].filter(Boolean).join(" · ");
    $("viewer-meta").className = "viewer-meta note";
    $("viewer-desc").textContent = work.description || "";

    const media = work.media || [];
    $("viewer-thumbs").innerHTML = media.length > 1
      ? media.map((m, i) => `
          <button class="thumb" role="listitem" data-i="${i}" aria-label="Item ${i + 1}${m.type === "video" ? " (film)" : ""}">
            <img src="${escapeHtml(thumbOf(m))}" alt="" loading="lazy">
            ${m.type === "video" ? `<span class="glyph">${ICON_PLAY}</span>` : ""}
          </button>`).join("")
      : "";

    if (!viewer.open) viewer.showModal();
    show(index);
    $("viewer-close").focus();
  }

  function show(i) {
    const media = (state.work && state.work.media) || [];
    viewer.classList.remove("is-playing");
    if (!media.length) { frames.innerHTML = ""; return; }
    state.index = (i + media.length) % media.length;
    const m = media[state.index];

    // Replacing the frame also stops any video that was playing.
    const frame = document.createElement("div");
    frame.className = "viewer-frame";
    if (m.type === "video") {
      frame.innerHTML = `
        <video src="${escapeHtml(m.src)}" ${m.poster ? `poster="${escapeHtml(m.poster)}"` : ""} preload="metadata" playsinline></video>
        <button class="play-btn" aria-label="Play film">${ICON_PLAY}</button>`;
      const video = frame.querySelector("video");
      const btn = frame.querySelector(".play-btn");
      btn.addEventListener("click", () => {
        video.controls = true;
        btn.remove();
        video.play().catch(() => {});
      });
      // Immersive while playing; captions return on pause or at the end.
      video.addEventListener("play", () => viewer.classList.add("is-playing"));
      video.addEventListener("pause", () => viewer.classList.remove("is-playing"));
      video.addEventListener("ended", () => viewer.classList.remove("is-playing"));
    } else {
      const img = document.createElement("img");
      img.src = m.src;
      img.alt = m.alt || state.work.title;
      img.draggable = false;
      frame.appendChild(img);
      enableZoom(frame, img);
    }
    frames.replaceChildren(frame);

    const many = media.length > 1;
    $("viewer-prev").hidden = !many;
    $("viewer-next").hidden = !many;
    $("viewer-count").className = "viewer-count note";
    $("viewer-count").textContent = many ? `${state.index + 1} / ${media.length}` : "";
    $("viewer-thumbs").querySelectorAll(".thumb").forEach((t, n) => {
      t.setAttribute("aria-current", String(n === state.index));
      if (n === state.index) t.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  // Click / tap to zoom an image to full detail; drag (mouse) or scroll (touch) to pan.
  function enableZoom(frame, img) {
    let drag = null;
    let moved = false;

    img.addEventListener("click", (e) => {
      if (moved) { moved = false; return; }
      if (frame.classList.contains("is-zoomed")) {
        frame.classList.remove("is-zoomed");
        img.style.width = "";
        return;
      }
      const rect = img.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      const scale = Math.min(Math.max(img.naturalWidth / rect.width, 2), 4);
      frame.classList.add("is-zoomed");
      img.style.width = `${rect.width * scale}px`;
      frame.scrollLeft = fx * img.offsetWidth - frame.clientWidth / 2;
      frame.scrollTop = fy * img.offsetHeight - frame.clientHeight / 2;
    });

    frame.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || !frame.classList.contains("is-zoomed")) return;
      drag = { x: e.clientX, y: e.clientY, sl: frame.scrollLeft, st: frame.scrollTop };
      moved = false;
    });
    frame.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; frame.classList.add("is-dragging"); }
      frame.scrollLeft = drag.sl - dx;
      frame.scrollTop = drag.st - dy;
    });
    const end = () => { drag = null; frame.classList.remove("is-dragging"); };
    frame.addEventListener("pointerup", end);
    frame.addEventListener("pointerleave", end);
  }

  const isZoomed = () => !!frames.querySelector(".viewer-frame.is-zoomed");

  $("viewer-prev").addEventListener("click", () => show(state.index - 1));
  $("viewer-next").addEventListener("click", () => show(state.index + 1));
  $("viewer-thumbs").addEventListener("click", (e) => {
    const t = e.target.closest(".thumb");
    if (t) show(Number(t.dataset.i));
  });

  // Swipe left/right on touch screens (ignored while zoomed, so panning works).
  let touch = null;
  frames.addEventListener("touchstart", (e) => {
    touch = e.touches.length === 1 && !isZoomed() ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  frames.addEventListener("touchend", (e) => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.x;
    const dy = e.changedTouches[0].clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && (state.work.media || []).length > 1) {
      show(state.index + (dx < 0 ? 1 : -1));
    }
  });

  viewer.addEventListener("keydown", (e) => {
    if (e.target.tagName === "VIDEO") return;   // let the video use arrow keys for seeking
    if (e.key === "ArrowLeft") show(state.index - 1);
    else if (e.key === "ArrowRight") show(state.index + 1);
  });

  // ---------- Opening / closing through the URL hash ----------

  function requestClose() {
    if (state.openedHere) history.back();       // also the phone's back gesture
    else {
      try { history.replaceState(null, "", location.pathname + location.search); } catch { location.hash = ""; }
      route();
    }
  }

  function closeViewer() {
    if (viewer.open) viewer.close();
    viewer.classList.remove("is-playing");
    frames.replaceChildren();                    // stops video playback
    state.work = null;
    state.openedHere = false;
  }

  function route() {
    const m = location.hash.match(/^#\/(.+)$/);
    const work = m && byId.get(decodeURIComponent(m[1]));
    if (work) { if (state.work !== work) openWork(work); }
    else closeViewer();
  }

  // Remember that the viewer was opened from this page, so closing can step back.
  document.addEventListener("click", (e) => {
    if (e.target.closest('a[href^="#/"]')) state.openedHere = true;
  });

  $("viewer-close").addEventListener("click", requestClose);
  viewer.addEventListener("cancel", (e) => { e.preventDefault(); requestClose(); });   // Esc
  viewer.addEventListener("click", (e) => {
    // Clicking the empty dark area around a photo/film closes the viewer.
    if (e.target.classList && e.target.classList.contains("viewer-frame") && !isZoomed()) requestClose();
  });
  window.addEventListener("hashchange", route);
  route();
})();
