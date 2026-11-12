// The short-flick regression used real coalesced events: the old sampler discarded the first
// event just as it crossed 100 ms, making a 36 px / 114 ms flick look like only 12 px / 48 ms.
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { strict: assert } = require('node:assert');
const ts = require('typescript');
let now = 0;
const moduleBox = { exports: {} };
runInNewContext(ts.transpileModule(readFileSync('src/hooks/swipe.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText, {
  exports: moduleBox.exports, require: () => ({}), performance: { now: () => now }
});
const { Velocity, flung } = moduleBox.exports;
const v = new Velocity();
v.add(0, 0); now = 66; v.add(24, 2.7); now = 114; v.add(36, 4);
assert(v.get().vx > .3, 'coalesced short reply flick must keep its velocity');
now = 230;
assert.equal(v.get().vx, 0, 'holding at release must cancel flick velocity');
assert(!flung(36, v.get().vx, 390));
now = 250; v.add(40, 4);
assert(v.get().vx < .1, 'resuming slowly after a hold must not retain the old flick');
console.log('PASS: coalesced flick, held release, slow restart');
