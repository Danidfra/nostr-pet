# Expressions

A shared expression system, so no animation invents its own faces.

- `faces.ts`: the named faces (happy, curious, surprised, worried,
  concentrating, relieved, sleepy, affectionate, and eating's chewing and
  munching), each in the kit's own vocabulary:
  - a preset;
  - a blend whose strongest preset is at least half, so V1/V2 art draws it;
  - or explicit parts.
  - `proceduralFace` gives the 3D model the same face, as the kit's
    procedural state.
- `controller.ts`: who wins when several moments want a face.
  - Each source asks with a priority (life < reaction < petting < care <
    script < journey) and, optionally, a duration.
  - The strongest wins; among equals, the latest.
  - A source asking again replaces its own request.
  - An interrupted face comes back underneath once the stronger one is
    cleared.
  - Runs on timers, not animation frames.
- `react/useExpression.ts`: the controller per Blobbi in React.
  - Eases between blendable faces in a few steps.
  - Changes at once to or from explicit parts (eyes shut), as a blink does.

The 2D drawing hands the face to `BlobbiRenderer`. The 3D model wears it
with `BlobbiModel.setFace`, built from the kit's own procedural face for
that expression: brows, mouth, cheeks, the kit's "wide" iris, and half or
shut lids. Each face is built once and kept.

Who uses it in the room:

| source | when |
|---|---|
| `reaction` | pokes, care results |
| `journey`, `relief` | teleporting |
| `transition` | room scenes |
| `care` | eager for food, then the bites |
| `petting` | being stroked |
| `playground` | the development panel |

The extraction boundary toward blobbi-kit is described in
`../teleport/KIT_EXTRACTION.md` §5.
