"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const c = require("../common.cjs");
const { fixture, fs, path } = require("./helpers.cjs");
test("package policy rejects data, secret files, linked paths and path traversal", () => {
  for (const name of ["../mrz.cmd", "control/mcp-connections.json", "app/.env", "app/worker/local-worker/templates/EmployeeID.psd", "queue/incoming/test.json", "app/tests/out/photo.png", "scripts/../../output/x", "scripts/CON.cjs", "scripts/atomic-json.cjs.", "scripts/x:stream", "scripts/x.tmp"]) assert.equal(c.managed(name), false, name);
  for (const name of ["mrz.cmd", "scripts/update.cjs", "app/dist/index.html", "app/local-server/server.js"]) assert.equal(c.managed(name), true, name);
});
test("local source edits block updates before any overwrite", async () => {
  const f = await fixture();
  try {
    const result = await f.command([], `const u=require('./scripts/update.cjs'),fs=require('fs');u.baseline();fs.appendFileSync('scripts/ui-server.cjs','// local edit');try{u.conflicts({files:{}});process.exitCode=2}catch(e){console.log(e.message)}`);
    assert.equal(result.exit, 0, result.output); assert.match(result.output, /Local program edits detected/);
  } finally { await f.cleanup(); }
});
test("verified update preserves settings and templates, rollback restores code", { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    const result = await f.command([], `const c=require('./scripts/common.cjs'),u=require('./scripts/update.cjs'),b=require('./scripts/build-release.cjs');(async()=>{
      u.baseline();c.write(c.path.join(c.CONTROL,'mcp-connections.json'),{owner:'preserve'});c.fs.mkdirSync('app/worker/local-worker/templates',{recursive:true});c.fs.writeFileSync('app/worker/local-worker/templates/owner.psd','private');
      const stage=c.path.join(c.CONTROL,'test-stage');c.fs.mkdirSync(stage,{recursive:true});const hashes={};for(const n of b.files(c.ROOT)){const dest=c.inside(stage,n);c.fs.mkdirSync(c.path.dirname(dest),{recursive:true});c.fs.copyFileSync(c.inside(c.ROOT,n),dest)}
      const v=c.read(c.path.join(stage,'release/version.json'));v.version='7.1.1';c.write(c.path.join(stage,'release/version.json'),v);const stamp=c.read(c.path.join(stage,'app/dist/mrz-build.json'));stamp.version='7.1.1';c.write(c.path.join(stage,'app/dist/mrz-build.json'),stamp);
      for(const n of b.files(stage))hashes[n]=c.hash(c.inside(stage,n));const manifest={schema:1,product:c.PRODUCT,version:'7.1.1',files:hashes};c.write(c.path.join(stage,'package-manifest.json'),manifest);await u.apply(stage,manifest);
      if(c.version().version!=='7.1.1'||c.read(c.path.join(c.CONTROL,'mcp-connections.json')).owner!=='preserve'||c.fs.readFileSync('app/worker/local-worker/templates/owner.psd','utf8')!=='private')throw Error('preservation failed');await u.rollback();if(c.version().version!=='7.1.0')throw Error('rollback failed');console.log('updated, preserved, rolled back')
    })().catch(e=>{console.error(e);process.exitCode=1})`);
    assert.equal(result.exit, 0, result.output); assert.match(result.output, /updated, preserved, rolled back/);
  } finally { await f.cleanup(); }
});
test("archive checksum failure leaves installed files unchanged", async () => {
  const f = await fixture();
  try {
    const result = await f.command([], `const c=require('./scripts/common.cjs'),u=require('./scripts/update.cjs'),b=require('./scripts/build-release.cjs');u.baseline();const m=c.read(c.path.join(c.CONTROL,'installed-files.json'));Object.assign(m,{archive_size:3,archive_sha256:'a'.repeat(64)});c.write('bad.json',m);c.fs.writeFileSync('bad.zip','bad');u.update({archive:'bad.zip',manifestFile:'bad.json'}).then(()=>process.exitCode=2).catch(e=>console.log(e.message))`);
    assert.equal(result.exit, 0, result.output); assert.match(result.output, /checksum failed/); assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, "release/version.json"))).version, "7.1.0");
  } finally { await f.cleanup(); }
});
test("failed post-install startup rolls back code and restarts the previous app", { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    const result = await f.command([], `const c=require('./scripts/common.cjs'),u=require('./scripts/update.cjs'),b=require('./scripts/build-release.cjs'),r=require('./scripts/runtime.cjs');(async()=>{
      u.baseline();await r.start({worker:false});const stage=c.path.join(c.CONTROL,'test-stage');c.fs.mkdirSync(stage,{recursive:true});const hashes={};for(const n of b.files(c.ROOT)){const dest=c.inside(stage,n);c.fs.mkdirSync(c.path.dirname(dest),{recursive:true});c.fs.copyFileSync(c.inside(c.ROOT,n),dest)}
      const v=c.read(c.path.join(stage,'release/version.json'));v.version='7.1.1';c.write(c.path.join(stage,'release/version.json'),v);const stamp=c.read(c.path.join(stage,'app/dist/mrz-build.json'));stamp.version='7.1.1';c.write(c.path.join(stage,'app/dist/mrz-build.json'),stamp);for(const n of b.files(stage))hashes[n]=c.hash(c.inside(stage,n));const m={schema:1,product:c.PRODUCT,version:'7.1.1',files:hashes};c.write(c.path.join(stage,'package-manifest.json'),m);
      const original=r.start;let tries=0;r.start=async(...args)=>{if(tries++===0)throw Error('simulated validation failure');return original(...args)};
      try{await u.apply(stage,m);throw Error('update should fail')}catch(e){if(!e.message.includes('previous version was restored'))throw e}
      if(c.version().version!=='7.1.0'||!(await c.readiness(c.read(c.STATE))).ready)throw Error('previous app not restored');console.log('failed update restored running app');
    })().catch(e=>{console.error(e);process.exitCode=1})`);
    assert.equal(result.exit, 0, result.output); assert.match(result.output, /restored running app/);
  } finally { await f.cleanup(); }
});
test("an interrupted update journal restores the previous program on recovery", async () => {
  const f = await fixture();
  try {
    const result = await f.command([], `const c=require('./scripts/common.cjs'),u=require('./scripts/update.cjs');(async()=>{u.baseline();const old=c.read(c.path.join(c.CONTROL,'installed-files.json')),backup='control/update-backups/interrupted',name='release/version.json';const saved=c.inside(c.inside(c.ROOT,backup),name);c.fs.mkdirSync(c.path.dirname(saved),{recursive:true});c.fs.copyFileSync(c.inside(c.ROOT,name),saved);c.write(c.inside(c.ROOT,name),{...c.version(),version:'7.1.9'});c.write(c.path.join(c.CONTROL,'update-transaction.json'),{product:c.PRODUCT,status:'applying',backup,paths:[name],old});await u.recover();if(c.version().version!=='7.1.0')throw Error('recovery failed');console.log('interrupted update recovered')})().catch(e=>{console.error(e);process.exitCode=1})`);
    assert.equal(result.exit, 0, result.output); assert.match(result.output, /interrupted update recovered/);
  } finally { await f.cleanup(); }
});
test("archive traversal is rejected before even a safe entry is extracted", async () => {
  const f = await fixture();
  try {
    fs.mkdirSync(path.join(f.root, "control/stage"), { recursive: true });
    fs.writeFileSync(path.join(f.root, "make-zip.ps1"), `param([string]$Archive)\n$ErrorActionPreference='Stop'\nAdd-Type -AssemblyName System.IO.Compression.FileSystem\nAdd-Type -AssemblyName System.IO.Compression\n$z=[IO.Compression.ZipFile]::Open($Archive,[IO.Compression.ZipArchiveMode]::Create)\ntry { foreach($name in @('scripts/safe.cjs','../escape.txt')) { $e=$z.CreateEntry($name);$w=[IO.StreamWriter]::new($e.Open());$w.Write('test');$w.Dispose() } } finally { $z.Dispose() }`);
    const result = await f.command([], `const {execFileSync}=require('child_process'),fs=require('fs'),path=require('path');execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','make-zip.ps1','-Archive',path.resolve('bad.zip')],{windowsHide:true});if(!fs.existsSync('bad.zip')||fs.statSync('bad.zip').size<50)throw Error('malicious fixture was not created');let rejected=false;try{execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/archive.ps1','-Mode','Unpack','-Archive',path.resolve('bad.zip'),'-Directory',path.resolve('control/stage')],{windowsHide:true,stdio:'pipe'})}catch(e){if(!String(e.stderr).includes('Unsafe archive path'))throw e;rejected=true}if(!rejected||fs.readdirSync('control/stage').length||fs.existsSync('control/escape.txt'))throw Error('archive escaped validation');console.log('archive traversal rejected')`);
    assert.equal(result.exit, 0, result.output); assert.match(result.output, /archive traversal rejected/);
  } finally { await f.cleanup(); }
});
