# Twodo · turns a Microsoft Rocketbox avatar (MIT, github.com/microsoft/Microsoft-Rocketbox) into public/people/<id>.glb:
# colour textures only (1024 px, opacity maps 512 px), no animation, T pose kept (the app lowers the arms itself).
# Needs Blender 4 with numpy:  blender -b --python convert_blender.py -- <avatar.fbx> <Textures dir> <out.glb> X 0 -
# The arm arguments (axis, angle) and the last one (a test render path, or -) are for checking a pose; use X 0 -.
# Face photos (public/people/<id>.jpg, 192 px) are rendered from the same files with three.js (docs/characters.md).
import bpy, sys, os, math
from mathutils import Euler
fbx, texdir, out, ax, ang, shot = sys.argv[sys.argv.index('--')+1:]
ang = float(ang)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx)
for o in list(bpy.data.objects):
    if o.type == 'EMPTY': bpy.data.objects.remove(o)
mesh = [o for o in bpy.data.objects if o.type == 'MESH'][0]
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
# textures: colour maps, resized
def img(name, size):
    p = os.path.join(texdir, name); im = bpy.data.images.load(p); im.scale(size, size); return im
for m in mesh.data.materials:
    base = m.name.split('_')[0]; kind = m.name.split('_')[-1]
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); outn = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(bsdf.outputs[0], outn.inputs[0])
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img(f'{base}_{kind}_color.tga', 512 if kind == 'opacity' else 1024)
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = .62
    if kind == 'opacity':
        nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha']); m.blend_method = 'HASHED'
# relaxed arms: bake the pose into the rest pose
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
for side, sgn in (('L', 1), ('R', -1)):
    b = arm.pose.bones[f'Bip01 {side} UpperArm']; b.rotation_mode = 'XYZ'
    e = [0, 0, 0]; e['XYZ'.index(ax)] = math.radians(ang) * sgn; b.rotation_euler = Euler(e)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.objects.active = mesh
mod = [m for m in mesh.modifiers if m.type == 'ARMATURE'][0]; name = mod.name
bpy.ops.object.modifier_apply(modifier=name)
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT'); bpy.ops.pose.armature_apply(); bpy.ops.object.mode_set(mode='OBJECT')
m2 = mesh.modifiers.new('Armature', 'ARMATURE'); m2.object = arm
if shot != '-':
    scn = bpy.context.scene; scn.render.engine = 'BLENDER_WORKBENCH'; scn.display.shading.color_type = 'TEXTURE'; scn.display.shading.light = 'STUDIO'
    scn.render.resolution_x, scn.render.resolution_y = 400, 600
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam); scn.camera = cam
    import mathutils
    bb = [mesh.matrix_world @ mathutils.Vector(c) for c in mesh.bound_box]; zs=[v.z for v in bb]; ys=[v.y for v in bb]; xs=[v.x for v in bb]
    h = max(zs)-min(zs); cz=(max(zs)+min(zs))/2
    cam.location = (0, min(ys) - h*2.2, cz); cam.rotation_euler = (math.radians(90), 0, 0); cam.data.lens = 50
    scn.render.filepath = shot; bpy.ops.render.render(write_still=True)
if out != '-':
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=82, export_animations=False, export_skins=True, export_yup=True)
print('DONE', len(mesh.data.polygons))
