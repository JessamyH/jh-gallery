"""
JH Gallery — build web media from the JH Archive.

Reads the original-quality archive (read only, never modified):

    F:\\JH-Archive\\Public\\<year>\\YYYY-MM-DD_Event-Name\\...

and writes web-ready copies to media/archive/<id>/:

    photos   → long edge 2500px JPEG, EXIF/GPS stripped        01.jpg, 02.jpg …
    videos   → 1080p H.264 + AAC, faststart, metadata stripped  <name>.mp4 + <name>.jpg poster
    audio    → square still-image MP4 over its cover            <name>.mp4 + <name>.jpg poster
               (no cover → a text cover in the site's style)

An image with the same name as a video/audio file is its cover, not a photo.
Files are taken in filename order. Work already done is skipped, so re-running
only converts what is new or changed.

Titles, tags, location and description live in meta.json next to the archive
(F:\\JH-Archive\\meta.json, keyed by id); "video_aspect": "2:3" there crops a
video (keeps the bottom, trims the top). New folders get a stub to fill in.

With --data, data/works.local.js is written from the archive + meta.json.
It is git-ignored, like media/archive/, so personal content never reaches the
public repo; the tracked data/works.js only holds the samples.

Usage:
    python tools/build.py                       # everything
    python tools/build.py --only spring-recital  # folders whose id contains this text
    python tools/build.py --data                # also write data/works.local.js
"""

import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = Path(r"F:\JH-Archive\Public")
OUT = ROOT / "media" / "archive"
WORKS_JS = ROOT / "data" / "works.local.js"   # git-ignored: real works stay off GitHub

PHOTO_EDGE = 2500
POSTER_EDGE = 2000
VIDEO_EDGE = 1920          # long edge → 1080p for 16:9, 1080×1920 for vertical
VIDEO_CRF = "23"
VIDEO_MAXRATE = "6M"       # caps very busy footage
AUDIO_COVER = 1080

VIDEO_EXT = {".mp4", ".mov", ".m4v", ".avi", ".mkv"}
AUDIO_EXT = {".m4a", ".wav", ".mp3", ".flac", ".aac"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}

# Site palette, for generated covers
BG, FRAME, INK, INK_SOFT, RED_INK = "#231c17", "#4c3f35", "#eee5d8", "#b4a696", "#cf6a64"
FONTS = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"

FOLDER_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})_(.+)$")


# ---------- tools ----------

def find_ffmpeg():
    for name in ("ffmpeg", "ffprobe"):
        if not shutil.which(name):
            break
    else:
        return "ffmpeg", "ffprobe"
    # winget installs here without touching the current shell's PATH
    hits = glob.glob(os.path.expandvars(
        r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\*\bin\ffmpeg.exe"))
    if not hits:
        sys.exit("ffmpeg not found. Install it with:  winget install Gyan.FFmpeg")
    bin_dir = Path(hits[0]).parent
    return str(bin_dir / "ffmpeg.exe"), str(bin_dir / "ffprobe.exe")


FFMPEG, FFPROBE = find_ffmpeg()


def run(args):
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def duration(path):
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True).stdout.strip()
    try:
        return float(out)
    except ValueError:
        return 0.0


def up_to_date(dst, *srcs):
    return dst.exists() and all(dst.stat().st_mtime >= s.stat().st_mtime for s in srcs)


def sig(*parts):
    """What an output was made from: file name + size + mtime, or plain text."""
    return " | ".join(f"{p.name}:{p.stat().st_size}:{p.stat().st_mtime_ns}" if isinstance(p, Path) else str(p)
                      for p in parts)


class Manifest:
    """media/archive/<id>/.sources.json — remembers which source made each output,
    so renaming or reordering files in the archive is picked up on the next run."""

    def __init__(self, out):
        self.path = out / ".sources.json"
        self.old = json.loads(self.path.read_text(encoding="utf-8")) if self.path.exists() else {}
        self.new = {}

    def fresh(self, dst, key, *srcs):
        if dst.exists() and self.old.get(dst.name) == key:
            return True
        # first run with a manifest: trust outputs that are newer than their sources
        if dst.name not in self.old and srcs and up_to_date(dst, *srcs):
            return True
        return False

    def keep(self, dst, key):
        self.new[dst.name] = key

    def save(self):
        out = self.path.parent
        for f in out.iterdir():          # drop outputs whose source is gone
            if f.is_file() and f.name not in self.new and f != self.path:
                print(f"  remove {f.name} (no longer in the archive)")
                f.unlink()
        self.path.write_text(json.dumps(self.new, ensure_ascii=False, indent=1), encoding="utf-8")


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


# ---------- converters ----------

def save_image(src, dst, edge):
    """Resize to fit `edge`, honour EXIF rotation, drop all metadata (incl. GPS)."""
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode != "RGB":
            im = im.convert("RGB")
        im.thumbnail((edge, edge), Image.LANCZOS)
        im.save(dst, "JPEG", quality=85, optimize=True, progressive=True)


def crop_filter(aspect):
    """Crop to aspect "W:H" keeping the bottom and the horizontal centre
    (trims empty sky off a tall video). Empty string = no crop."""
    if not aspect:
        return ""
    w, h = (int(v) for v in aspect.split(":"))
    return (f"crop='min(iw,ih*{w}/{h})':'min(ih,iw*{h}/{w})':"
            f"'(iw-min(iw,ih*{w}/{h}))/2':'ih-min(ih,iw*{h}/{w})',")


def convert_video(src, dst, aspect=""):
    scale = (f"scale='if(gte(iw,ih),min({VIDEO_EDGE},iw),-2)':"
             f"'if(gte(iw,ih),-2,min({VIDEO_EDGE},ih))'")
    run(["-i", str(src), "-map_metadata", "-1", "-vf", crop_filter(aspect) + scale,
         "-c:v", "libx264", "-preset", "slow", "-crf", VIDEO_CRF,
         "-maxrate", VIDEO_MAXRATE, "-bufsize", "12M",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
         "-movflags", "+faststart", str(dst)])


def grab_poster(video, dst):
    at = duration(video) * 0.1
    tmp = dst.with_suffix(".tmp.png")
    run(["-ss", f"{at:.2f}", "-i", str(video), "-frames:v", "1", str(tmp)])
    save_image(tmp, dst, POSTER_EDGE)
    tmp.unlink()


def text_cover(dst, title, kicker, date_label, subtitle=""):
    """A square cover in the site's palette, for audio with no artwork."""
    size = 1600
    im = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(im)
    d.rectangle([70, 70, size - 70, size - 70], outline=FRAME, width=3)

    def font(name, px):
        try:
            return ImageFont.truetype(str(FONTS / name), px)
        except OSError:
            return ImageFont.load_default()

    # Georgia has no Chinese; use Noto Serif SC for titles that need it
    cjk = any(ord(c) > 0x2e80 for c in title)
    f_kick, f_date, f_sub = font("georgia.ttf", 40), font("georgiai.ttf", 54), font("georgiai.ttf", 58)
    f_title = font("NotoSerifSC-VF.ttf", 120) if cjk else font("georgia.ttf", 120)
    if cjk:
        try:
            f_title.set_variation_by_name("Regular")
        except (OSError, ValueError, AttributeError):
            pass

    # wrap the title to the frame width
    words, lines, line = title.split(), [], ""
    for w in words:
        test = f"{line} {w}".strip()
        if d.textlength(test, font=f_title) > size - 360 and line:
            lines.append(line)
            line = w
        else:
            line = test
    lines.append(line)

    kick = "   ".join(kicker.upper())          # letter-spaced small caps feel
    block = 60 + 50 + len(lines) * 140 + (90 if subtitle else 0) + 50 + 60
    y = (size - block) // 2
    d.text((size / 2, y), kick, font=f_kick, fill=RED_INK, anchor="mt")
    y += 110
    for ln in lines:
        d.text((size / 2, y), ln, font=f_title, fill=INK, anchor="mt")
        y += 140
    if subtitle:
        y += 20
        d.text((size / 2, y), subtitle, font=f_sub, fill=INK, anchor="mt")
        y += 70
    y += 50
    d.text((size / 2, y), date_label, font=f_date, fill=INK_SOFT, anchor="mt")
    im.save(dst, "JPEG", quality=90)


def convert_audio(src, cover_jpg, dst):
    fit = (f"scale={AUDIO_COVER}:{AUDIO_COVER}:force_original_aspect_ratio=decrease,"
           f"pad=ceil(iw/2)*2:ceil(ih/2)*2")
    run(["-loop", "1", "-framerate", "1", "-i", str(cover_jpg), "-i", str(src),
         "-map_metadata", "-1", "-vf", fit,
         "-c:v", "libx264", "-tune", "stillimage", "-preset", "slow", "-crf", "20", "-r", "1",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest",
         "-movflags", "+faststart", str(dst)])


# ---------- archive → works ----------

MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def scan(src_root):
    for year_dir in sorted(p for p in src_root.iterdir() if p.is_dir()):
        for folder in sorted(p for p in year_dir.iterdir() if p.is_dir()):
            m = FOLDER_RE.match(folder.name)
            if not m:
                print(f"  skip (name not YYYY-MM-DD_Event): {folder}")
                continue
            y, mo, d, event = m.groups()
            yield folder, f"{y}-{mo}-{d}", slug(f"{y}-{mo}-{d}-{event}"), event.replace("-", " ")


def build_work(folder, date, wid, meta):
    files = sorted(p for p in folder.iterdir() if p.is_file())
    av = [p for p in files if p.suffix.lower() in VIDEO_EXT | AUDIO_EXT]
    av_stems = {p.stem.lower() for p in av}
    covers = {p.stem.lower(): p for p in files
              if p.suffix.lower() in IMAGE_EXT and p.stem.lower() in av_stems}
    photos = [p for p in files if p.suffix.lower() in IMAGE_EXT and p.stem.lower() not in av_stems]
    for p in files:
        if p.suffix.lower() not in VIDEO_EXT | AUDIO_EXT | IMAGE_EXT:
            print(f"  ! unsupported, skipped: {p.name}")

    out = OUT / wid
    out.mkdir(parents=True, exist_ok=True)
    mf = Manifest(out)
    media, n = [], 0

    for p in files:
        ext = p.suffix.lower()
        if p in photos:
            n += 1
            dst = out / f"{n:02d}.jpg"
            key = sig(p)
            if not mf.fresh(dst, key, p):
                print(f"  photo  {p.name} → {dst.name}")
                save_image(p, dst, PHOTO_EDGE)
            mf.keep(dst, key)
            media.append({"type": "image", "src": dst})
        elif ext in VIDEO_EXT | AUDIO_EXT:
            name = slug(p.stem)
            mp4, poster = out / f"{name}.mp4", out / f"{name}.jpg"
            cover = covers.get(p.stem.lower())
            if cover:
                pkey = sig(cover)
                if not mf.fresh(poster, pkey, cover):
                    print(f"  cover  {cover.name} → {poster.name}")
                    save_image(cover, poster, POSTER_EDGE)
            if ext in AUDIO_EXT:
                if not cover:
                    y, mo, d = map(int, date.split("-"))
                    texts = (meta.get("title") or p.stem.replace("-", " "),
                             (meta.get("tags") or ["Piano"])[0], f"{d} {MONTHS[mo - 1]} {y}",
                             meta.get("subtitle", ""))
                    pkey = sig("generated", *texts)
                    if not mf.fresh(poster, pkey):
                        print(f"  cover  (generated) → {poster.name}")
                        text_cover(poster, *texts)
                key = sig(p, pkey)
                if not mf.fresh(mp4, key, p, poster):
                    print(f"  audio  {p.name} → {mp4.name}")
                    convert_audio(p, poster, mp4)
            else:
                aspect = meta.get("video_aspect", "")
                key = sig(p, f"aspect {aspect}") if aspect else sig(p)
                if not mf.fresh(mp4, key, p):
                    print(f"  video  {p.name} → {mp4.name}{' cropped to ' + aspect if aspect else ''}"
                          "  (this takes a while)")
                    convert_video(p, mp4, aspect)
                if not cover:
                    pkey = sig("frame", p)
                    if not mf.fresh(poster, pkey, mp4):
                        print(f"  poster (frame) → {poster.name}")
                        grab_poster(mp4, poster)
            mf.keep(mp4, key)
            mf.keep(poster, pkey)
            media.append({"type": "video", "src": mp4, "poster": poster})
    mf.save()
    return media


def rel(p):
    return p.relative_to(ROOT).as_posix()


def versioned(p):
    """Media URL with a version tag, so browsers fetch a file again once it changes."""
    st = p.stat()
    return f"{rel(p)}?v={(st.st_mtime_ns // 1_000_000 ^ st.st_size) & 0xFFFFFF:06x}"


def write_works_js(works):
    lines = [
        "// GENERATED by tools/build.py from the JH Archive — do not edit by hand.",
        "// Edit titles, tags, location and descriptions in meta.json (next to the archive), then re-run:",
        "//   python tools/build.py --data",
        "",
        "window.GALLERY = " + json.dumps({
            "siteTitle": "JH Gallery",
            "tagline": "Life in motion. Moments in light.",
            "works": works,
        }, ensure_ascii=False, indent=2) + ";",
        "",
    ]
    WORKS_JS.write_text("\n".join(lines), encoding="utf-8")


def main():
    sys.stdout.reconfigure(encoding="utf-8")   # Windows consoles default to cp1252
    ap =argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--only", help="only folders whose id contains this text (repeatable, comma-separated)")
    ap.add_argument("--data", action="store_true", help="write data/works.local.js")
    args = ap.parse_args()

    if not args.src.is_dir():
        sys.exit(f"Archive not found: {args.src}")
    only = [s.strip().lower() for s in (args.only or "").split(",") if s.strip()]

    META = args.src.parent / "meta.json"          # lives with the archive, not in the repo
    meta = json.loads(META.read_text(encoding="utf-8")) if META.exists() else {}
    works = []
    for folder, date, wid, title in scan(args.src):
        if only and not any(o in wid for o in only):
            continue
        meta.setdefault(wid, {"title": title, "tags": [], "location": "", "description": ""})
        m = meta[wid]
        print(f"{wid}")
        media = build_work(folder, date, wid, m)
        if not media:
            print("  (empty, skipped)")
            continue
        work = {"id": wid, "title": m.get("title") or title, "date": date}
        for k in ("original", "location", "tags", "description", "featured"):
            if m.get(k):
                work[k] = m[k]
        work["media"] = [{k: (versioned(v) if isinstance(v, Path) else v) for k, v in item.items()} for item in media]
        works.append(work)

    # Re-read before saving so edits made while this was running are kept;
    # only stubs for new folders are added.
    saved = json.loads(META.read_text(encoding="utf-8")) if META.exists() else {}
    for wid, m in meta.items():
        saved.setdefault(wid, m)
    META.write_text(json.dumps(saved, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.data:
        if only:
            sys.exit("--data needs the whole archive; run without --only.")
        write_works_js(works)
        print(f"wrote {rel(WORKS_JS)} ({len(works)} works)")


if __name__ == "__main__":
    main()
