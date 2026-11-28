# The city in Explore

Explore is a modern city by a lake, lit by the phone's own clock. You arrive on a granite plaza with a fountain, a
bench, the night kitchen under an elevated train, a photo kiosk and towers of glass, concrete and charcoal. West of
the plaza a wooden promenade runs along the lake, with trees, benches and street lamps; walks follow the streets to
the south and east. The **Loft** keeps the Journal desk and the **Garage** the workbench (it opens the task patch).
**Walk to** lists Plaza, Lakeside, Loft and Garage. The bench, Moments, Chat, the avatar close-up and paired
reactions use their existing controls.

## The light follows the hour (2026-11-28, third request)

Asked for: full screen like other city apps, no white strip at the top, a badge instead of the two names across the
top, realistic rather than flashy lights, a real sky by the time of day with sunsets and birds, and a bigger map.

- **The sun** (`lib/courtyard/daylight.ts`): from the phone's local time and date only, at a fixed latitude of 20°
  (−25° when the time zone is in the southern hemisphere), with solar noon at 12:18 standard time and summer time
  taken into account. That puts sunsets within minutes of real ones across most of a time zone (about 17:45 in
  southern India in late November). **No location is read**, and nothing about the time is stored or sent.
- **The sky** (`sky.ts`): a dome coloured by the sun's height (blue by day, gold and pink at sunset, a city's navy
  at night, never black), the sun's disc and glow, a warm band along the horizon around sunset, clouds lit by the
  hour, stars and the moon at night (the moon hangs low over the lake to the west). The dome alone becomes the
  reflections, so glass and water show this hour's sky; they are remade only when the sky's colours change.
- **The light**: the sun casts the shadows by day and the moon at night; the sky's own light fills them. Windows
  light up after sunset (about half of them, warm or cool, some with blinds down), shop fronts glow, street lamps and
  their pools come on, billboards light from inside. Neon is a night accent only (the train's edge, a line along the
  plaza, the loft and garage), and the bloom is close to none by day and soft at night. A soft light travels with
  the camera after dark, so the two of you stay visible.
- **Birds** (`birds.ts`): pigeons looping over the plaza, gulls over the lake and a far flock beyond it, by day and
  at sunset only. One instanced mesh; the wings beat in the vertex shader.
- **The lake**: rippled water that catches the sun (the ripples drift slowly), a seawall, a glass railing, a far
  shore about 300 m away with its own skyline (hazy by day, lit windows at night).
- **Full screen**: the city runs under the status bar and under the bar at the bottom. Home's header gives way to a
  badge with both faces, both first names and whether your partner is here; the place and the time of day sit
  below it; the way out (×) is top right. The doors (Task patch, Moments, camera, photos) sit above the bar, the
  stick and actions above them; in landscape the doors stack above the stick so the middle stays clear.
- **The status bar**: the manifest requests fullscreen. While Explore is in front, both the actual document edge
  and theme colour take the rendered sky tint (exposure, vignette, ACES tone mapping); leaving Explore or covering
  it restores the ordinary theme. Some iOS builds reserve or blur this OS-owned area even with the fullscreen
  request. See `docs/iphone-validation.md` for the physical-device check.

### Staying alive, then resting

The city draws while something moves, then for **30 seconds after your last touch** at about 30 frames a second,
so birds, clouds, the train, the water and the residents go on living; then it rests and draws nothing
(`data-ambient` on the canvas says which). Once a minute it draws a single frame to follow the sun. With Reduce
Motion there is no ambient time, the birds are hidden and nothing drifts. Behind another screen, in the background
or off screen, nothing draws at all, as before.

### The bigger map and what it means for data

`state.ts` documents the walkable regions: the plaza as before, the promenade (x −19.3 to −8.9), the south walk
(z 7.9 to 13.3) and the east walk (x 8.9 to 12.2), each overlapping the plaza a little so their seams are never a
gap; trees, benches, the photographer and lamp posts are obstacles. A walk from any landmark to any other still
finishes within 20 seconds (`tests/courtyard.cjs`).

Presence is unchanged: the same encrypted pose, the same fields and bounds checks (`cleanPose` uses `walkable()`).
A pose on the promenade is simply a new position. A phone still on the previous version rejects such a pose as out of
bounds and shows its partner resting on the bench until they walk back onto the plaza; the app updates both phones
on their next launch. No storage keys, records, network origins or requests were added; the textures are painted
on the phone.

### Cost

The opening phone-sized Chromium render is about 85–120 draw calls (including the post-processing passes) and
70,000 triangles, plus three residents' models (same origin). The shadow map is drawn once and again only when the
sun or moon has moved half a degree; the reflections only when the sky's colours change.

## Physical iPhone checklist

1. Open **Home → Explore our place**: the city fills the screen, the status bar shows the sky's colour (not white),
   and the badge shows both your names and faces. Leave with × and the status bar is the app's colour again.
2. At midday the city is daylit, signs read as printed signs, nothing glows. Around sunset (or set the phone's
   clock) the sky turns gold and pink, windows begin to light; at night the windows, street lamps and moon are lit
   and the two of you are still visible.
3. **Walk to → Lakeside**, turn towards the water: ripples, the far shore, birds by day; at sunset the sun over the
   water. Walk the south and east streets back to the plaza.
4. Stop touching for half a minute: birds and the train stop, the phone stays cool. Touch again: they carry on.
5. With Reduce Motion on, nothing drifts and there are no birds.
6. The Loft (Journal desk), the Garage (workbench), the bench, Moments, Chat, reactions and the avatar close-up work
   as before, in portrait and landscape.

## Earlier versions

- **Neon city** (first request): a night plaza with an illuminated fountain, towers, a photo kiosk and the train.
- **Sharper neon city** (second request): post-processing (multisampled half-float frames, bloom, vignette), a
  violet sky, neon towers and holograms, your partner's name plate and three residents (a dancer and a fan at the
  night kitchen, a photographer, now at the lake railing). The finish, the name plate and the residents remain;
  the violet sky, holograms, sky cars and corner neon were replaced by the light of the hour.
