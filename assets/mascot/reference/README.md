# Mariner Blue NA Miata - animation reference pack

> **In this repo:** only the two sheets the site uses are kept, `01-turnaround-final.png` (the side view) and `02-headlights.png` (the three-quarter and head-on headlight states), plus `manifest.json`. The rest of the pack (roof, lighting and steering sheets, labeled pages, prompts) stays with the owner's original copy. `node scripts/build-mascot-sprites.mjs` turns these sheets into `assets/mascot/*.webp`. This folder is not deployed. The notes below are the pack's original handoff.

This pack contains 43 reference poses across five transparent PNG atlases, plus labeled reference pages and a machine-readable state map. Artwork was generated with the built-in `image_gen` tool from the four supplied photographs. Exact generation and refinement prompts are in `prompts/`. Some prompted left/right camera names were interpreted inconsistently by the generator; the visually checked final manifest and labels take precedence over the prompts.

## Files to give the next LLM

1. `reference-guide.pdf` or the matching images in `labeled/` for labeled visual context.
2. The five transparent PNG files listed in `manifest.json` for source artwork.
3. This guide and `manifest.json` for state definitions and reference-cell coordinates.

## Identity that must stay fixed

- First-generation NA Miata, detailed 16-bit-era pixel-art treatment with realistic roadster proportions.
- Mariner Blue body and matching Mariner Blue mirror caps.
- Silver stock daisy wheels, black interior, no occupant.
- Smooth stock trunk: no luggage rack, luggage carrier, or spoiler.
- Black fabric soft top in the roof-up references; lowered top in all other sheets.
- No anthropomorphic eyes, mouth changes, or invented trim. The pop-up headlights provide the expression.

## Left and right

Every label uses the vehicle's own left and right. A front-left camera sees the car's left flank. In a straight front view, the car's left lamp is on the image's right. In a rear view, the car's left lamp is on the image's left.

The raw eight-view sheet order is front, front-right, right, rear-left, rear, rear-right, left, front-left. Both turnaround sheets use this order. The manifest records the observed contents of each cell; use it rather than assuming a different compass order.

## Available states

| Atlas | Contents |
| --- | --- |
| `01-turnaround-final.png` | Eight directions, roof down, headlights down/off, wheels straight |
| `02-headlights.png` | Front and front-right cameras: down/off, halfway/off, up/off, up/on, left-only raised/off, right-only raised/off |
| `03-roof-up.png` | Same eight directions, black soft top fully up |
| `04-lighting.png` | Rear off, rear brakes on, rear left/right indicators, front left/right indicators |
| `05-steering.png` | Left/straight/right steering from front, front-left, and front-right cameras |

Both headlight camera blocks use the same six-state order. In the steering sheet, the head-on row runs left/straight/right; the two three-quarter rows run right/straight/left. Labels and manifest IDs explicitly describe their visible state.

## Animation instructions

Use these as reference artwork, not as already registered playback frames. Before making an animation, select one camera and keep body geometry, wheelbase, perspective, scale, paint shades, and ground contact fixed. Align the body and wheel contact points; transparent padding and generated proportions can vary between cells. Prefer keeping one body sprite and changing only the moving or illuminated part. Sample pixels with nearest-neighbor filtering when resizing.

- **Headlights opening:** down/off -> halfway/off -> up/off. Reverse this sequence to close. The half-raised housings rotate physically; do not substitute a brightness fade.
- **Headlights switching on:** up/off -> up/on. The circular pop-up bulbs illuminate. White highlights in the narrow bumper lenses in the base art are reflections, not the headlights being switched on.
- **Wink:** start both down or both up, move the chosen vehicle-side housing, and return. Both supplied one-sided raised states have unlit bulbs.
- **Braking:** alternate the rear off state and brake state. Illuminate both red brake-lens regions and the central high-mounted brake light. White reverse lenses are not brake lamps; keep them unlit in new frames.
- **Indicators:** alternate the relevant on state with an off baseline. Front and rear states must use the same vehicle-side convention. The off front baseline is in the turnaround sheet. Keep the body fixed while changing the amber lamps.
- **Steering:** left -> straight -> right, pivoting only front wheels. Keep rear wheels straight and body heading fixed. Turning the vehicle itself requires separate animation.
- **Roof:** the two eight-view sheets supply fully down and fully up endpoints. They do not depict the folding mechanism or intermediate roof frames. Synthesize those if the later animation requires a folding sequence.

## Coordinates and output limits

`manifest.json` uses zero-based `row` and `col`, a top-left pixel origin, and `rect: [x, y, width, height]`. Rectangles describe the reference cells, including transparent padding. They are not tight bounding boxes or engine-ready pivot metadata. Use the recorded rectangles: some turnaround columns use adjusted boundaries to avoid clipping wide side profiles.

The PNGs retain their generated alpha channels. The artwork targets a 16-bit visual style; it is not constrained to a hardware palette or an exact logical-pixel grid. A downstream production sprite pass can normalize the palette, pixel scale, anchors, and frame timing.

## Suggested prompt for the animation LLM

> Use the attached Miata reference pack and manifest as the source of truth. Preserve the Mariner Blue body and mirror caps, silver daisy wheels, black interior, stock trunk without a rack, and detailed 16-bit pixel style. Interpret left/right from the vehicle's perspective. For the requested animation, lock one camera, body shape, palette, scale, and wheel contact points. Animate only the relevant mechanical parts or lamp regions. Keep the background transparent. Use nearest-neighbor scaling. State the chosen frame dimensions, anchor, timing, and loop behavior, and create any necessary in-between frames without changing the car's identity.
