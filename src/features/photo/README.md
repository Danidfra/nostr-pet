# Photo: the Blobbi Polaroid (P1)

A portrait of the Blobbi to keep or to send. Local only: no Nostr event, no
relay, no stored caption, no server. The picture exists in the sheet until
it is closed.

## How it is made

| file | what it does |
|---|---|
| `blobbi-portrait.ts` | The Blobbi as it sits for the photo: `renderBlobbiSvg` options from `toBlobbiVisual` (stage, generation, colours, V3 identity), front, still; eyes shut when sleeping; an egg's shell as cracked as it is; the home's face when a stat is critical, a smile otherwise (`PHOTO_SMILE`). |
| `polaroid-layout.ts` | Pure: the 1080 x 1350 layout, the three frames (`classic`, `pastel`, `playful`) with every decoration placed by hand, caption cleaning and wrapping, the name, the date, the file name. |
| `rasterize.ts` | The SVG string as a sized data URL an `<img>` can load; image loading with CORS. |
| `compose-polaroid.ts` | One offscreen 2D canvas: paper, backdrop, shadow, accessories, Blobbi, decorations, words; PNG out. Everything the browser provides comes through `ComposeEnv`. |
| `share.ts` | `navigator.share({ files })` where `canShare` allows; `<a download>` otherwise; a closed share sheet is `cancelled`, not an error. |
| `PolaroidSheet.tsx` | The sheet (a `GameOverlay`): live preview, frames, caption, date (off by default), Share / Save. |
| `PolaroidDoor.tsx`, `PhotoTile.tsx` | What the homes import: the lazy door (the sheet is its own chunk, loaded on first open) and the "Photo" tile in the Blobbi's details, in both homes. |

No WebGL context is created and the 3D room's renderer is not read or
changed: the portrait is the kit's 2D drawing in both homes, also for a
Blobbi shown as a 3D model in the room.

## What it wears

- **Accessories** (the Island's wearables) are drawn the way the kit's
  renderer places them. Each image is loaded with `crossOrigin =
  'anonymous'`; one whose host does not allow that fails to load, is left
  out, and the sheet says so ("One thing it wears could not be put in the
  picture"). A canvas is therefore never tainted; should an export refuse
  anyway, the picture is redrawn with nothing worn. Only this origin's own
  URLs and `https:` ones are asked for.
- **Visual effects** (auras, sparkles: the renderer's CSS-animated layers)
  are not in the picture in P1. They exist only as React layers in the kit,
  not in the string API.

## Checked automatically

`npm run test` (jsdom has no canvas, so the composer runs against a
recording canvas): portrait options for every stage and generation and that
each drawing is self-contained; the layout and that no decoration covers
the Blobbi or the words; caption cleaning, limits and wrapping; accessory
placement, CORS failures and the tainted-canvas retry; share and download
fallbacks; the sheet's preview, frames, caption, date and buttons.

By eye, in Chrome on a desktop: Dev Lab (`/dev`) -> "Polaroid lab"
develops the fixture as egg / baby / adult in V1, V2 and V3 through the
same composer, in each frame, asleep, with a cracked shell, a caption and
a date. The sheet was opened from both homes, also at 390 px wide.

## Still to check by hand on real devices

None of these can be exercised from a desktop browser or jsdom.

1. **iPhone Safari**: the picture draws (SVG -> canvas), Comfortaa is used
   for the words, Share opens the system sheet with a PNG that can be saved
   to Photos and sent to an app.
2. **iPhone, installed app (Add to Home Screen)**: Share works from the
   standalone app; "Save image" (`<a download>`) is known to be unreliable
   there, so confirm what it does and that the status line and the long
   press are enough.
3. **Long press on the preview** (iPhone Safari and installed, Android
   Chrome): offers "Save to Photos" / "Download image", in the 2D home and
   in the 3D room (`.room-shell` turns the callout off for its drags;
   `.polaroid__picture` turns it back on, which only iOS can show).
4. **Android Chrome and an installed Android app**: Share with a file, and
   Save into Downloads.
5. **The keyboard**: typing a caption on a phone does not hide the field or
   zoom the page (the field is 16 px), and the sheet scrolls to the buttons.
6. **A Blobbi wearing Island accessories**: whether the catalog's image
   host answers with CORS headers (then they are in the picture) or not
   (then the note shows). No real worn accessory was available to try.
7. **Memory on an old phone**: a 1080 x 1350 canvas while the 3D room is
   open (the room keeps its own context; nothing was lost on a desktop).
8. **Firefox desktop / Android**: no file sharing, so one Save button.
