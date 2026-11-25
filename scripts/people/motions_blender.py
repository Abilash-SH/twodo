# Twodo · turns Microsoft Rocketbox motion-capture animations (MIT, github.com/microsoft/Microsoft-Rocketbox,
# Assets/Animations) into small files any human skeleton can play: public/people/motion/<g>_<name>.json.
#
# Each frame stores, for each body bone, how far it has turned from a T pose, in the world (glTF axes: Y up, the
# person facing +Z), plus where the hips are. A skeleton with other bone names or axes (a Rocketbox person, or your own
# avatar) plays it by turning each of its bones by the same amount from its own T pose (src/lib/mocap.ts).
#
# Needs Blender 4:  blender -b --python motions_blender.py -- <reference avatar.fbx> <out dir> <g> <name>=<file.fbx>[@start-end][,loop][,walk] ...
#   Kept at 20 frames a second (the app blends between them). Fingers keep the clip's first hand pose (still).
#   reference avatar: a Rocketbox avatar of the same body (its bind pose is the T pose the turns are measured from)
#   start-end: seconds to keep (default: all); loop: the clip loops; walk: the hips' travel is removed and kept as a speed
import bpy, sys, os, json, math, base64, struct
from mathutils import Quaternion, Vector

BODY = {  # humanoid name: Rocketbox bone
    'hips': 'Bip01 Pelvis', 'spine': 'Bip01 Spine', 'spine1': 'Bip01 Spine1', 'spine2': 'Bip01 Spine2', 'neck': 'Bip01 Neck', 'head': 'Bip01 Head',
    'lShoulder': 'Bip01 L Clavicle', 'lArm': 'Bip01 L UpperArm', 'lForeArm': 'Bip01 L Forearm', 'lHand': 'Bip01 L Hand',
    'rShoulder': 'Bip01 R Clavicle', 'rArm': 'Bip01 R UpperArm', 'rForeArm': 'Bip01 R Forearm', 'rHand': 'Bip01 R Hand',
    'lUpLeg': 'Bip01 L Thigh', 'lLeg': 'Bip01 L Calf', 'lFoot': 'Bip01 L Foot', 'lToe': 'Bip01 L Toe0',
    'rUpLeg': 'Bip01 R Thigh', 'rLeg': 'Bip01 R Calf', 'rFoot': 'Bip01 R Foot', 'rToe': 'Bip01 R Toe0',
}
FINGERS = {}
for s, S in (('l', 'L'), ('r', 'R')):
    for i, f in enumerate(('Thumb', 'Index', 'Middle', 'Ring', 'Pinky')):
        for j in range(3):
            FINGERS[f'{s}{f}{j + 1}'] = f'Bip01 {S} Finger{i}' + ('' if j == 0 else str(j))
ALL = {**BODY, **FINGERS}
# the humanoid bone a finger joint hangs from: a still joint keeps its turn relative to it
PARENT = {f'{s}{f}{j}': (f'{s}Hand' if j == 1 else f'{s}{f}{j - 1}') for s in 'lr' for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky') for j in (1, 2, 3)}
C = Quaternion((1, 0, 0), -math.pi / 2)            # Blender (Z up) to glTF (Y up)
Ci = C.inverted()
def g_rot(q): return C @ q @ Ci
def g_pos(v): return Vector((v.x, v.z, -v.y))

def load(fbx):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=fbx)
    return [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
def wrot(m): return m.to_3x3().normalized().to_quaternion()

args = sys.argv[sys.argv.index('--') + 1:]
ref_fbx, out_dir, g = args[0], args[1], args[2]
arm = load(ref_fbx)
REF = {h: g_rot(wrot(arm.matrix_world @ arm.data.bones[b].matrix_local)) for h, b in ALL.items() if b in arm.data.bones}
# The turns are measured from a true T pose: arms straight out, legs straight down (Rocketbox avatars are bound with
# their arms lower). src/lib/mocap.ts measures every skeleton the same way, so the turns carry over.
P = {h: g_pos(arm.matrix_world @ arm.data.bones[b].head_local) for h, b in ALL.items() if b in arm.data.bones}
HUM = {b: h for h, b in ALL.items()}
def below(h): return [h] + [HUM[c.name] for c in arm.data.bones[ALL[h]].children_recursive if c.name in HUM and HUM[c.name] in REF]
def align(h, nxt, want):
    d = (P[nxt] - P[h]).normalized(); fix = d.rotation_difference(want); pivot = P[h].copy()
    for x in below(h): REF[x] = fix @ REF[x]; P[x] = pivot + fix @ (P[x] - pivot)
for s, out in (('l', 1), ('r', -1)):
    align(f'{s}Arm', f'{s}ForeArm', Vector((out, 0, 0))); align(f'{s}ForeArm', f'{s}Hand', Vector((out, 0, 0)))
    align(f'{s}UpLeg', f'{s}Leg', Vector((0, -1, 0))); align(f'{s}Leg', f'{s}Foot', Vector((0, -1, 0)))
hips0 = g_pos(arm.matrix_world @ arm.data.bones[BODY['hips']].head_local)
H = hips0.y                                          # hips height in the T pose: positions are stored in hips heights
print('REF', len(REF), 'hips height', round(H, 3))

def q16(vals): return base64.b64encode(struct.pack(f'<{len(vals)}h', *[max(-32767, min(32767, round(v * 32767))) for v in vals])).decode()
def p16(vals): return base64.b64encode(struct.pack(f'<{len(vals)}h', *[max(-32767, min(32767, round(v * 10000))) for v in vals])).decode()

for spec in args[3:]:
    name, rest = spec.split('=', 1)
    flags = rest.split(',')[1:]; fbx = rest.split(',')[0]
    rng = None
    if '@' in fbx: fbx, r = fbx.split('@'); rng = tuple(float(x) for x in r.split('-'))
    arm = load(fbx); sc = bpy.context.scene; src = sc.render.fps / sc.render.fps_base; fps = 20
    a, b = (int(v) for v in arm.animation_data.action.frame_range)
    if rng: a, b = a + round(rng[0] * src), min(b, a + round(rng[1] * src))
    have = [h for h in ALL if h in REF and ALL[h] in arm.pose.bones]
    rots = {h: [] for h in have}; hips = []
    for k in range(int((b - a) / src * fps) + 1):
        t = a + k * src / fps
        sc.frame_set(int(t), subframe=t - int(t))
        for h in have:
            d = g_rot(wrot(arm.matrix_world @ arm.pose.bones[ALL[h]].matrix)) @ REF[h].inverted()
            prev = rots[h][-1] if rots[h] else None
            if prev is not None and prev.dot(d) < 0: d.negate()         # same hemisphere: no flips between frames
            rots[h].append(d)
        hips.append(g_pos(arm.matrix_world @ arm.pose.bones[BODY['hips']].head))
    n = len(hips); dur = (n - 1) / fps
    speed = 0.0
    if 'walk' in flags:                               # in place: take the travel out, keep its speed
        travel = hips[-1] - hips[0]; travel.y = 0
        speed = travel.length / dur / H
        hips = [p - travel * (i / (n - 1)) for i, p in enumerate(hips)]
    base = Vector((hips[0].x, hips0.y, hips[0].z))    # the hips start over the feet, at T-pose height
    moving = [h for h in have if h in BODY]
    still = [h for h in have if h not in moving]
    out = {
        'v': 1, 'name': name, 'g': g, 'fps': fps, 'frames': n, 'loop': 'loop' in flags, 'speed': round(speed, 4),
        'bones': moving, 'q': q16([c for i in range(n) for h in moving for c in (rots[h][i].x, rots[h][i].y, rots[h][i].z, rots[h][i].w)]),
        # a still bone: its turn relative to the bone it hangs from (first frame), so it follows that bone
        'still': still, 'sq': q16([c for h in still for r in [rots[PARENT[h]][0].inverted() @ rots[h][0]] for c in (r.x, r.y, r.z, r.w)]),
        'hips': p16([c for p in hips for c in ((p - base).x / H, (p - base).y / H, (p - base).z / H)]),
        'source': 'Microsoft Rocketbox (MIT): ' + os.path.basename(fbx).replace('.max.fbx', ''),
    }
    path = os.path.join(out_dir, f'{g}_{name}.json')
    with open(path, 'w') as fh: json.dump(out, fh, separators=(',', ':'))
    print('CLIP', name, n, 'frames', round(dur, 2), 's', 'moving', len(moving), 'still', len(still), 'speed', round(speed, 3), os.path.getsize(path), 'bytes')
