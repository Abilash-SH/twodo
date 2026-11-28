# Neon city in Explore

Explore opens in a walkable night plaza with an illuminated fountain, layered towers, a photo kiosk, warm
street-front windows and an elevated Moonline train. The **Loft** is a lounge with the existing Journal desk.
The **Garage** retains the workbench and opens the task patch. **Walk to** lists Neon Plaza, Loft and Garage.
The bench, Moments, Chat, avatar close-up and paired reactions use their existing controls.

## Build and compatibility

The city uses original geometry and procedurally painted pavers, windows and signs. Explore generates them
when it opens. Boxes that share a material render in batches. Coloured light pools suggest reflections on
the pavement. The train moves with the existing scene frames and stops when the scene rests or Reduce
Motion is enabled. The city palette is scoped to Explore and its controls stay legible over the scene.

The plaza, room footprints, paths and virtual position bounds retain their original coordinates. The visible
area names use the existing internal area IDs. The photo kiosk sits beside the garage on an existing fixture.
The same encrypted presence channel, input and task and journal entry points carry through. City rendering
adds no network origins, database fields, storage keys or requests for environment artwork.

## Physical iPhone checklist

1. Open **Home → Explore our place** and turn the camera around the plaza. Check that the buttons are legible
   in portrait and landscape and that the skyline, fountain and train read clearly.
2. Use **Walk to → Loft** and open Journal at the desk. Walk back out through the doorway. Enter Garage and
   use the workbench, then return to Neon Plaza.
3. With both phones in Explore, check that movement and Wave, Clap and Cheer appear for both people. Open
   Chat and come back. With Reduce Motion enabled, check that the train stays still as you move.
4. Check a return visit on the same device for entrance time and walking frame pacing.

## Sharper neon city (2026-11-28, second request)

Asked for: nicer graphics, sharp edges and characters in the neon city, with a cosmic reference picture (purple
space, glowing frames, light streaks). Everything here is original and drawn on the phone.

- **The finish** (`lib/courtyard/post.ts`): every frame is drawn multisampled (4×) in half-float, then bloom on
  anything brighter than white, a soft vignette, and tone mapping. Neon materials are brighter than white on
  purpose, so only neon, signs and the brightest windows glow. A phone without half-float render targets draws
  straight to the screen instead (`data-finish="plain"`); the look stays, without the glow.
- **The sky** (`lib/courtyard/sky.ts`): a violet gradient dome, 760 fixed stars, a ringed planet and three light
  streaks, all painted on the phone. A small room of coloured light panels becomes the environment map, so glass,
  chrome and the wet street reflect neon instead of grey.
- **The towers** (`environment.ts`, `city-art.ts`): dark glass bodies whose windows are an emission map at a fixed
  2.6 m scale (merged into one mesh per kind), neon strips up their corners or bands across them, setback upper
  floors, glass spires and red beacons, a far ring of towers on every horizon. Around the plaza they are lower than
  before (×0.7) so the sky shows above them. Four holograms (TWODO, SIGNAL, STARLIGHT, NEO TWODO) and two sky cars.
- **The plaza**: dark tiles with glowing seams, painted crosswalk, three coloured street lamps (fountain, night
  kitchen, photo kiosk) and cyan and pink rim light from behind, so people get a neon outline.
- **Characters**: your partner has a name plate (name, then "Here now" / "Resting on the bench"), kept over their
  head by the scene with a transform only. Three residents spend the evening outside the walkable plaza: a dancer
  and a fan clapping at the night kitchen, a photographer at the east edge. They are models neither of you picked,
  load after the two of you, and are decoration only (a failure is silent). They move only while the scene draws,
  like the train, and stand still with Reduce Motion.
- **The display**: a location badge (NEO TWODO, the area, the time), cut-corner panels in condensed italic
  capitals with one neon edge, a pink Find button, a neon stick. Opaque panels, no blur.

Unchanged: coordinates, rooms, seats, obstacles and walkable bounds (`state.ts`), presence, the on-demand render
loop (nothing draws at rest), pausing behind other screens, the WebGL fallback, and every control's name.

### Cost and fallbacks

The opening phone-sized Chromium render is about 87 draw calls (including the post-processing passes) and 60,000
triangles, plus three residents' models (0.5–1.2 MB each, same origin, kept by the service worker once fetched).
`renderer.info` now counts every pass of a frame. A phone that misses 45 ms on most of 40 frames drops from
1.5× to its plain pixel ratio once (`data-dpr`).

### Physical iPhone checklist (additions)

1. The towers' edges and the signs glow without smearing; text on holograms stays readable.
2. Walk to the bench: Deiva's name plate stays over her head as the camera turns, and hides in the avatar close-up.
3. Look up (drag down): stars, the planet and the far skyline above the towers.
4. Walk for a minute: frame pacing and warmth compared with the previous neon city.

