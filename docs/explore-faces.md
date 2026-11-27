# Explore facial geometry prototypes

Explore has two refined faces for the existing Female / Honey / Espresso and Male / Caramel / Black choices.
Twodo previously showed these faces at a distance and kept them neutral through every body reaction.
These prototypes refine the cheek and jaw profile, shape the eyelid rims and lips, and add separate smile and
brow shapes. Wave, Clap and Cheer use the existing body clips with different expression curves. Each face
returns to neutral. Reduce Motion holds the neutral face.

## Assets and provenance

The meshes and colour maps start from the existing MIT-licensed Rocketbox `f07` and `m17` assets. The new
facial surface and expression shapes were authored for Twodo. The Rocketbox license and attribution are at
`public/people/LICENSE-Rocketbox.md`. The assets use no personal photos.

From the repository root, `python3 scripts/people/explore_faces.py` with NumPy rebuilds both GLBs. The build
splits facial triangles where more detail is needed, interpolates UVs and normalized joint weights, preserves the
rest of the rig and embeds the base textures. The two standalone files are 1,247,332 and 748,296 bytes, with
7,450 and 7,548 head triangles. That is about 493 KB and 8,524 extra head triangles compared with the original
pair. An uncached Explore visit requests both prototype files when both eligible looks are in use. The ordinary
Home portraits still use their existing assets.

Explore tries an imported avatar first, an eligible prototype next, and the selected original rig last.
Previously loaded prototype files use the same versioned offline cache as other character assets. Model choice
adds no preference, storage key, database field, encryption change or network origin.

## Physical iPhone review

1. With the matching skin and hair choice, open Explore and compare the walk view with **View avatar**. Drag to
   check the forehead, nose, lips and jaw from the front and three-quarter angles.
2. Try Wave, Clap and Cheer while watching both people. Each expression should settle to neutral. Repeat with
   Reduce Motion and verify the face stays neutral.
3. Turn to landscape, walk through the villa and garage, and try a second visit offline after the files have
   loaded. If you use an imported avatar, check that it takes priority.
4. Compare how long the first entrance takes and how steady walking feels on the same phone, before deciding
   whether to expand the prototypes to more looks.
