"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { fixture, fs, path } = require("./helpers.cjs");
test("Windows read locks are retried without deleting the previous JSON", { timeout: 30000 }, async () => {
  const f = await fixture();
  try {
    fs.writeFileSync(path.join(f.root, "lock-json.ps1"), `param([string]$File)\n$s=[IO.File]::Open($File,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)\ntry { [Console]::WriteLine('LOCKED');[Console]::Out.Flush();Start-Sleep -Milliseconds 400 } finally { $s.Dispose() }`);
    const result = await f.command([], `const c=require('./scripts/common.cjs'),{spawn}=require('child_process');(async()=>{const file=c.path.join(c.CONTROL,'locked.json');c.write(file,{old:true});const holder=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','lock-json.ps1','-File',file],{windowsHide:true});let text='';const exit=new Promise(resolve=>holder.once('exit',resolve));await new Promise((resolve,reject)=>{holder.stdout.on('data',b=>{text+=b;if(text.includes('LOCKED'))resolve()});holder.once('error',reject);holder.once('exit',code=>{if(!text.includes('LOCKED'))reject(Error('lock failed '+code))})});const began=Date.now();c.write(file,{new:true});await exit;if(!c.read(file).new||Date.now()-began<250)throw Error('lock retry failed');if(c.fs.readdirSync(c.CONTROL).some(n=>n.endsWith('.tmp')))throw Error('temporary file left');console.log('Windows lock survived')})().catch(e=>{console.error(e);process.exitCode=1})`);
    assert.equal(result.exit, 0, result.output); assert.match(result.output, /Windows lock survived/);
  } finally { await f.cleanup(); }
});
