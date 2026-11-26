"""Access regressions for the local mock. Production rules must also be published to Firebase."""
import copy
import importlib.util
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location('firebase_mock', Path(__file__).with_name('mock_firebase.py'))
mock = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mock)
space = 'a' * 40
before = {'spaces': {space: {'members': {'a': True, 'b': True}}}}
mock.DB = before
packet = {'u': int(time.time() * 1000), 'd': 'A' * 100}

def allowed(uid, path, value):
    after = copy.deepcopy(before)
    after['spaces'][space]['world'] = {'a': value}
    return mock.can_write(['spaces', space, 'world', path], uid, before, after)

assert mock.can_read(['spaces', space, 'world', 'a'], 'b')
assert not mock.can_read(['spaces', space, 'world', 'a'], 'outsider')
assert allowed('a', 'a', packet)
assert not allowed('b', 'a', packet)
assert not allowed('outsider', 'a', packet)
assert not allowed('a', 'a', {**packet, 'd': 'A' * 1025})
assert not allowed('a', 'a', {**packet, 'u': packet['u'] + 30000})
assert not allowed('a', 'a', {**packet, 'u': packet['u'] - 30000})
assert not allowed('a', 'a', {**packet, 'x': 2})
print('PASS: member reads, owner-only writes, outsider denial, timestamp/size/unknown-field rejection.')
