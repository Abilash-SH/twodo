# Explore villa and garage

The owner wants an enterable villa and garage, more natural character faces and more ways to greet each other.
This branch extends the existing courtyard, with a living room, a garage workbench, and the existing garden.
Rooms share the courtyard's world coordinates and both are reachable by walking or the destination controls.
Use the living room desk for Journal and the garage workbench for the task patch.

Walls, openings and camera collision use the same layout. The occupied room's roof is hidden. Interiors share
the courtyard renderer and have a shorter camera distance. Nearby actions require being on the same side of the
building entrance.

Walking and actor animation use elapsed time with a stall cap. Movement still takes collision substeps and
consumes the rest of a frame's distance when it reaches a waypoint. Camera easing keeps its smaller step.
The browser trace reproduced the old slow walk at about three software-rendered frames per second. This
verifies the simulation under delayed frames. Physical iPhone frame pacing still needs a device check.

## Presence compatibility

The current encrypted path and Firebase rules stay in place. Wave, clap and cheer share the existing wave mode.
An optional gesture field selects clap or cheer on updated clients. Earlier clients receive the regular wave.
Publication samples the person's tap before the next render. The receiver starts the clip when it can draw.
Older versions may refuse positions inside walls from their own layout. Use the same updated build on both phones
to test indoor presence. Coordinates remain virtual, and no task, journal or photo content enters presence.

## Character art

Use the approved realistic reference as the target for faces, anatomy, clothing and lighting. The current
licensed meshes and the existing optional personal GLB import retain their rigs and animation support.
The close-up frames the avatar's head position and adds a directional fill.
Photoreal replacement faces require rigged models with documented reuse rights and physical iPhone checks.
Do not treat lighting or screenshot art as a replacement for those models.
