"""Build the two local Explore face prototypes from the MIT Rocketbox files in public/people.

Run from the repository root with python3 scripts/people/explore_faces.py (requires NumPy).
The original rigs, images and body primitives are retained. Coordinates in the sculpts use metres.
"""
import json
import struct
from pathlib import Path

import numpy as np

PEOPLE = Path('public/people')
# Eye centre (abs X, Y), mouth corner (abs X, Y), cheek Y, chin Y, front of face.
SCULPTS = {
    'f07': (.0315, 1.614, .0225, 1.550, 1.578, 1.518, .022),
    'm17': (.0345, 1.687, .024, 1.620, 1.651, 1.581, .079),
}
DTYPES = {5121: 'u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
SIZES = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def refined_geometry(attrs, indices, sculpt):
    positions = attrs['POSITION']
    eye_x, eye_y, corner_x, mouth_y, cheek_y, chin_y, front = sculpt

    def face_mask(points, normals):
        x, y, z = points.T
        return (ramp(z, front, front + .015) * ramp(normals[:, 2], -.18, .45)
                * ramp(y, chin_y - .018, chin_y + .012) * (1 - ramp(y, eye_y + .025, eye_y + .050))
                * (1 - ramp(abs(x), .050, .079)))

    # Match on position across UV seams. Every triangle incident to a split edge gets a matching midpoint.
    _, position_ids = np.unique(positions.round(6), axis=0, return_inverse=True)

    def physical_edge(a, b):
        return tuple(sorted((position_ids[a], position_ids[b])))

    marked = set()
    selected = face_mask(positions, attrs['NORMAL']) > .30
    for a, b, c in indices:
        if selected[a] + int(selected[b]) + int(selected[c]) >= 2:
            marked.update((physical_edge(a, b), physical_edge(b, c), physical_edge(c, a)))
    vertices = {name: list(values) for name, values in attrs.items()}
    midpoints = {}

    def midpoint(a, b):
        key = tuple(sorted((a, b)))
        if key not in midpoints:
            midpoints[key] = len(vertices['POSITION'])
            for name, attr in attrs.items():
                if name not in ('JOINTS_0', 'WEIGHTS_0'):
                    vertices[name].append(np.mean(attr[[a, b]], axis=0))
            weights = {}
            for i in (a, b):
                for joint, weight in zip(attrs['JOINTS_0'][i], attrs['WEIGHTS_0'][i]):
                    weights[int(joint)] = weights.get(int(joint), 0) + float(weight)
            top = sorted(weights, key=weights.get, reverse=True)[:4]
            total = sum(weights[joint] for joint in top)
            vertices['JOINTS_0'].append(top + [0] * (4 - len(top)))
            vertices['WEIGHTS_0'].append([weights[joint] / total for joint in top] + [0] * (4 - len(top)))
        return midpoints[key]

    faces = []
    for a, b, c in indices:
        ab, bc, ca = [midpoint(u, v) if physical_edge(u, v) in marked else None
                      for u, v in ((a, b), (b, c), (c, a))]
        if ab is None and bc is None and ca is None:
            faces.append((a, b, c))
        elif ab is not None and bc is not None and ca is not None:
            faces.extend(((a, ab, ca), (ab, b, bc), (ca, bc, c), (ab, bc, ca)))
        else:
            # Rotate the triangle so the first side is split and a second split follows it.
            if ab is None or (bc is None and ca is not None):
                a, b, c, ab, bc, ca = b, c, a, bc, ca, ab
            if ab is None or (bc is None and ca is not None):
                a, b, c, ab, bc, ca = b, c, a, bc, ca, ab
            if bc is None:
                faces.extend(((a, ab, c), (ab, b, c)))
            else:
                faces.extend(((a, ab, c), (ab, bc, c), (ab, b, bc)))

    attrs = {name: np.asarray(values, dtype=attrs[name].dtype) for name, values in vertices.items()}
    faces = np.asarray(faces, dtype=indices.dtype)
    base = attrs['POSITION']
    normals = unit(attrs['NORMAL'])
    x, y, _ = base.T
    ax = abs(x)
    mask = face_mask(base, normals)
    cheek = bump(ax - eye_x - .009, y - cheek_y, .025, .021)
    nose = bump(x, y - (eye_y - .024), .016, .033)
    lips = bump(x, y - mouth_y, .024, .008)
    eyelid_radius = np.hypot((ax - eye_x) / .014, (y - eye_y) / .006)
    rims = np.exp(-((eyelid_radius - 1) / .44) ** 2)
    neutral = base.copy()
    neutral[:, 2] += mask * (.004 * cheek + .0022 * nose + .0022 * lips + .0016 * rims)
    jaw = bump(ax - .046, y - chin_y - .012, .026, .020)
    neutral[:, 0] -= mask * np.sign(x) * .0025 * jaw
    attrs['POSITION'] = neutral
    attrs['NORMAL'] = unit(normals + surface_normals(neutral, faces) - surface_normals(base, faces))

    corners = bump(ax - corner_x, y - mouth_y, .010, .013)
    lower_lid = bump(ax - eye_x, y - eye_y + .007, .014, .004)
    smile = np.column_stack((np.sign(x) * .0025 * corners,
                             .010 * corners + .0032 * cheek + .0018 * lower_lid,
                             .0024 * corners + .002 * cheek)) * mask[:, None]
    brow = bump(ax - eye_x, y - eye_y - .017, .019, .008)
    brighten = np.column_stack((np.zeros_like(x), .0045 * brow, .001 * brow)) * mask[:, None]
    return attrs, faces, [smile, brighten]


def ramp(x, low, high):
    t = np.clip((x - low) / (high - low), 0, 1)
    return t * t * (3 - 2 * t)


def bump(x, y, width, height):
    return np.exp(-((x / width) ** 2 + (y / height) ** 2))


def unit(vectors):
    return vectors / np.maximum(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-8)


def surface_normals(positions, faces):
    a, b, c = positions[faces].transpose(1, 0, 2)
    normal = np.cross(b - a, c - a)
    # The same geometry vertex can appear multiple times in the glTF at a UV seam.
    _, ids = np.unique(positions.round(6), axis=0, return_inverse=True)
    summed = np.zeros_like(positions)
    for side in faces.T:
        np.add.at(summed, ids[side], normal)
    return unit(summed[ids])


def build(person, sculpt):
    source = (PEOPLE / f'{person}.glb').read_bytes()
    json_length = struct.unpack_from('<I', source, 12)[0]
    gltf = json.loads(source[20:20 + json_length])
    buffer = source[28 + json_length:]
    views, accessors = gltf['bufferViews'], gltf['accessors']
    data = [buffer[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in views]

    def read(index):
        info = accessors[index]
        assert 'byteStride' not in views[info['bufferView']]
        return np.frombuffer(data[info['bufferView']], DTYPES[info['componentType']],
                             offset=info.get('byteOffset', 0),
                             count=info['count'] * SIZES[info['type']]).reshape(info['count'], -1)

    def replace(index, values):
        info = accessors[index]
        info.pop('byteOffset', None)
        info['count'] = len(values)
        data[info['bufferView']] = values.astype(DTYPES[info['componentType']]).tobytes()
        if 'min' in info:
            info['min'] = values.min(axis=0).tolist()
            info['max'] = values.max(axis=0).tolist()

    head = gltf['meshes'][0]['primitives'].pop(1)
    assert gltf['materials'][head['material']]['name'].endswith('_head')
    gltf['materials'][head['material']]['pbrMetallicRoughness']['roughnessFactor'] = .68
    attrs = {name: read(index) for name, index in head['attributes'].items()}
    attrs, faces, shapes = refined_geometry(attrs, read(head['indices']).reshape(-1, 3), sculpt)
    for name, values in attrs.items():
        replace(head['attributes'][name], values)
    replace(head['indices'], faces.reshape(-1, 1))

    head['targets'] = []
    for shape in shapes:
        head['targets'].append({'POSITION': len(accessors)})
        accessors.append({'bufferView': len(views), 'componentType': 5126, 'type': 'VEC3',
                          'count': len(shape), 'min': shape.min(0).tolist(), 'max': shape.max(0).tolist()})
        views.append({'buffer': 0})
        data.append(shape.astype('<f4').tobytes())

    body_node = next(i for i, node in enumerate(gltf['nodes']) if node.get('mesh') == 0)
    siblings = next(node['children'] for node in gltf['nodes'] if body_node in node.get('children', []))
    siblings.append(len(gltf['nodes']))
    gltf['nodes'].append({**gltf['nodes'][body_node], 'mesh': len(gltf['meshes']), 'name': 'TwodoFace'})
    gltf['meshes'].append({'name': 'TwodoFace', 'primitives': [head],
                           'extras': {'targetNames': ['twodoSmile', 'twodoBrighten']}, 'weights': [0, 0]})

    packed = bytearray()
    for view, chunk in zip(views, data):
        view.update(byteOffset=len(packed), byteLength=len(chunk))
        packed += chunk + bytes(-len(chunk) % 4)
    gltf['buffers'][0]['byteLength'] = len(packed)
    manifest = json.dumps(gltf, separators=(',', ':')).encode()
    manifest += b' ' * (-len(manifest) % 4)
    result = struct.pack('<4sII', b'glTF', 2, 28 + len(manifest) + len(packed))
    result += struct.pack('<I4s', len(manifest), b'JSON') + manifest
    result += struct.pack('<I4s', len(packed), b'BIN\0') + packed
    output = PEOPLE / 'explore' / f'{person}.glb'
    output.parent.mkdir(exist_ok=True)
    output.write_bytes(result)
    print(f'{output} {len(faces):,} head triangles, {len(result):,} bytes ({len(result) - len(source):+,})')


if __name__ == '__main__':
    for name, features in SCULPTS.items():
        build(name, features)
