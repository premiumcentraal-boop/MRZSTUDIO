"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { fixture } = require("./helpers.cjs");
test("the packaged Windows ZIP round-trips through the actual verified updater", { timeout: 30000 }, async () => {
  const f = await fixture();
  try {
    const result = await f.command([], `const c=require('./scripts/common.cjs'),b=require('./scripts/build-release.cjs'),u=require('./scripts/update.cjs'),{execFileSync}=require('child_process');const manifest=b.build(),stage=c.path.join(c.CONTROL,'roundtrip');c.fs.mkdirSync(stage,{recursive:true});execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',c.path.join(c.ROOT,'scripts/archive.ps1'),'-Mode','Unpack','-Archive',c.path.join(c.ROOT,'artifacts/releases',manifest.archive),'-Directory',stage],{windowsHide:true});u.verifyStage(stage,manifest);console.log('release roundtrip verified');`);
    assert.equal(result.exit, 0, result.output); assert.match(result.output, /release roundtrip verified/);
  } finally { await f.cleanup(); }
});
