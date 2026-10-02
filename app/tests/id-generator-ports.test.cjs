const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {createPlugin,hubUrl}=require('../local-server/id-generator/plugin');
const {createStore,DEFAULTS}=require('../local-server/id-generator/store');
const model=require('../local-server/id-generator/model.cjs');
const BASE=path.resolve(__dirname,'../../artifacts/id-generator-acceptance/tests');fs.mkdirSync(BASE,{recursive:true});
const secret='k1.id-generator-contract-test';process.env.CYCLONE_PLUGIN_SECRET=secret;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY1sAAAAASUVORK5CYII=','base64');
function sign(raw,url,key=secret,requestId=crypto.randomUUID(),t=Math.floor(Date.now()/1000)){
  const m=/^(k\d+)\.(.+)$/.exec(key);const hash=crypto.createHash('sha256').update(raw).digest('hex');const sig=crypto.createHmac('sha256',m?m[2]:key).update(`${t}\n${requestId}\nPOST\n${url}\n${hash}`).digest('hex');return `t=${t},kid=${m?m[1]:'k1'},id=${requestId},v1=${sig}`;
}
async function fixture(){
  const root=fs.mkdtempSync(path.join(BASE,'ports-')),jobs=new Map();let plugin,calls=0;
  const server=http.createServer(async(req,res)=>{if(req.url==='/v1/artifacts/photo'||req.url==='/v1/ports/artifacts/photo?t=one-use'){res.writeHead(200,{'Content-Type':'image/png'});res.end(PNG);return;}if(await plugin.handle(req,res))return;res.writeHead(404);res.end();});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port,base=`http://127.0.0.1:${port}`;
  const paths={root,incoming:path.join(root,'incoming'),done:path.join(root,'done'),failed:path.join(root,'failed'),output:path.join(root,'output'),workerOutput:path.join(root,'worker-output'),workerCurrentJob:path.join(root,'current-job'),heartbeat:path.join(root,'heartbeat.json')};
  const reopen=async()=>{await plugin?.close();plugin=createPlugin({control:path.join(root,'control'),paths,apiPort:port,render:async()=>{calls++;return {photo:PNG,signature:PNG};},load:key=>jobs.has(key)?{job:jobs.get(key),stage:jobs.get(key).status==='processing'?'processing':'done'}:null,resolve:key=>path.join(paths.output,key,'front.png'),publish:async(job)=>{const dir=path.join(paths.output,job.id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'front.png'),PNG);jobs.set(job.id,{...job,status:'complete',output_front_png_path:'front.png'});}});};
  await reopen();
  async function post(url,body,opts={}){const raw=JSON.stringify(body),headers={'Content-Type':'application/json','X-Cyclone-Contract':'cyclone.ports/1',...opts.headers};if(opts.signed!==false)headers['X-Cyclone-Signature']=opts.signature||sign(raw,opts.signPath||url,opts.key);const res=await fetch(base+url,{method:'POST',headers,body:raw});return {status:res.status,body:await res.json()};}
  function envelope(port,data,extra={}){return {v:1,id:'msg_'+crypto.randomBytes(6).toString('hex'),runId:'run_test',port,way:'out',seq:1,sentAt:new Date().toISOString(),sensitivity:'personal',data,...extra};}
  async function cleanup(){await plugin.close();await new Promise(r=>server.close(r));if(path.dirname(root)!==BASE||fs.lstatSync(root).isSymbolicLink())throw Error('Unsafe test cleanup.');fs.rmSync(root,{recursive:true,force:true});}
  return {root,get plugin(){return plugin;},paths,reopen,jobs,base,post,envelope,cleanup,calls:()=>calls};
}
const employee={first_name:'Sam',last_name:'Example',birth_date:'1990-06-14',valid_from:'2026-10-01',city_of_birth:'Custom Town',height_cm:188};
test('artifact URLs accept SDK and real Glass paths but refuse unrelated or remote URLs',()=>{
  for(const u of ['http://127.0.0.1:8765/v1/ports/artifacts/art_photo?t=one-use','http://127.0.0.1:8794/v1/artifacts/photo?t=test'])assert.equal(hubUrl(u,'artifact').protocol,'http:');
  for(const u of ['https://example.com/v1/ports/artifacts/photo','http://127.0.0.1:8765/v1/ports/plugins','http://127.0.0.1:8765/v1/artifacts/photo/../../settings','http://user:pw@127.0.0.1/v1/artifacts/photo'])assert.throws(()=>hubUrl(u,'artifact'));
});
test('canonical model preserves template name order, MRZ checks, random and manual values, custom city and height',()=>{
  const form=model.normalizeEmployee(employee);const payload=model.employeePayload(form);assert.equal(payload.first_name,'Example');assert.equal(payload.last_name,'Sam');assert.equal(payload.height,'1,88 m');assert.equal(payload.city_of_birth,'Custom Town');assert.match(payload.mrz,/EXAMPLE<<SAM/);
  assert.ok(payload.mrz.split('\n').every(l=>l.length===30));assert.equal(model.normalizeEmployee({...employee,doc_number:form.doc_number,personal_number:form.personal_number}).doc_number,form.doc_number);
  assert.throws(()=>model.normalizeEmployee({...employee,doc_number:'NOT_VALID'}));assert.throws(()=>model.normalizeEmployee({...employee,birth_date:'2026-02-30'}));assert.throws(()=>model.normalizeEmployee({...employee,height_cm:300}));
  for(const country of ['NL','DE','OTHER']){const p=model.employeePayload(model.normalizeEmployee({...employee,country,doc_type:'passport'}));assert.ok(p.mrz.split('\n').every(l=>l.length===44));}
});

test('restart recovers a published job without rendering twice and preserves replay/await/cancel state',async()=>{
  const f=await fixture();try{
    const photo=f.envelope('file.out',{assetId:'photo-restart'},{artifactUrl:f.base+'/v1/artifacts/photo'});
    await f.post('/ports/file.out',photo);
    const generated=f.envelope('x.id-generator.generate',{requestId:'restart',photoId:'photo-restart',employee});
    const raw=JSON.stringify(generated),signature=sign(raw,'/ports/x.id-generator.generate');
    await f.post('/ports/x.id-generator.generate',generated,{signature});
    for(let i=0;i<50&&!f.jobs.size;i++)await delay(50);assert.equal(f.jobs.size,1);
    const record=f.plugin.store.get(generated.id);record.status='received';f.plugin.store.put(record);
    const wait={v:1,runId:'run_test',port:'value.in',awaitId:'aw_restart',match:{requestId:'not-ready'},timeoutS:60,deliverUrl:f.base+'/v1/ports/run_test/value.in/deliver',token:'restart-token'};
    await f.post('/ports/value.in/await',wait);const before=f.plugin.store.wait('run_test:value.in:aw_restart');
    await f.post('/ports/value.in/cancel',{...wait,awaitId:'aw_cancelled'});
    await f.reopen();await f.plugin.pump();
    assert.equal(f.calls(),1);assert.equal(f.jobs.size,1);assert.equal(f.plugin.store.get(generated.id).status,'queued');
    assert.equal((await f.post('/ports/x.id-generator.generate',generated,{signature})).status,401);
    assert.equal((await f.post('/ports/x.id-generator.generate',generated)).body.duplicate,true);
    await f.post('/ports/value.in/await',wait);const after=f.plugin.store.wait('run_test:value.in:aw_restart');
    assert.equal(after.deliveryId,before.deliveryId);assert.equal(after.expiresAt,before.expiresAt);
    await f.post('/ports/value.in/await',{...wait,awaitId:'aw_cancelled'});assert.equal(f.plugin.store.wait('run_test:value.in:aw_cancelled').status,'cancelled');
  }finally{await f.cleanup();}
});

test('retention removes plugin files and stale worker inputs while preserving active and ordinary jobs',async()=>{
  const f=await fixture();try{
    const jobId=crypto.randomUUID(),activeId=crypto.randomUUID(),ordinaryId=crypto.randomUUID();
    for(const root of [f.paths.done,f.paths.output,f.paths.workerOutput])for(const key of [jobId,activeId,ordinaryId]){fs.mkdirSync(path.join(root,key),{recursive:true});fs.writeFileSync(path.join(root,key,'private.txt'),'employee fixture');}
    fs.mkdirSync(f.paths.workerCurrentJob,{recursive:true});fs.writeFileSync(path.join(f.paths.workerCurrentJob,'input.json'),JSON.stringify({job_id:jobId,first_name:'private-fixture'}));fs.writeFileSync(f.paths.heartbeat,'{}');
    const old=Date.now()-25*3600000;
    f.jobs.set(jobId,{id:jobId,status:'complete'});f.jobs.set(activeId,{id:activeId,status:'processing'});
    for(const key of [jobId,activeId])f.plugin.store.put({id:key,port:'x.id-generator.generate',runId:'local_panel',requestId:key,jobId:key,status:'queued',createdAt:old,mrz:'private-fixture'});
    f.plugin.store.put({id:'old-photo',port:'file.out',runId:'local_panel',status:'ready',createdAt:old});fs.writeFileSync(path.join(f.plugin.store.photos,f.plugin.store.digest('old-photo')+'.bin'),PNG);
    await f.plugin.pump();assert.equal(f.plugin.store.get(jobId).status,'expired');assert.equal(f.plugin.store.get(jobId).mrz,undefined);
    for(const root of [f.paths.done,f.paths.output,f.paths.workerOutput]){assert.equal(fs.existsSync(path.join(root,jobId)),false);assert.ok(fs.existsSync(path.join(root,activeId)));assert.ok(fs.existsSync(path.join(root,ordinaryId)));}
    assert.equal(fs.existsSync(path.join(f.paths.workerCurrentJob,'input.json')),false);assert.equal(fs.existsSync(path.join(f.plugin.store.photos,f.plugin.store.digest('old-photo')+'.bin')),false);
  }finally{await f.cleanup();}
});

test('HTTP key rotation accepts both current and next key and rejects unknown key ids',async()=>{
  process.env.CYCLONE_PLUGIN_SECRET_NEXT='k2.id-generator-next-test';
  const f=await fixture();try{
    for(const key of [secret,process.env.CYCLONE_PLUGIN_SECRET_NEXT])assert.equal((await f.post('/ports/x.id-generator.generate',f.envelope('x.id-generator.generate',{}),{key})).status,202);
    assert.equal((await f.post('/ports/x.id-generator.generate',f.envelope('x.id-generator.generate',{}),{key:'k3.unknown-key'})).status,401);
  }finally{await f.cleanup();delete process.env.CYCLONE_PLUGIN_SECRET_NEXT;}
});
test('SDK vectors match the unmodified vendor verifier, including path/query, replay and rotation',async()=>{
  const {verifyCyclone}=await import('../local-server/id-generator/vendor/verify.mjs');const vectors=require('./ports-signature-vectors.json').vectors;
  for(const v of vectors){const m=/^(k\d+)\.(.+)$/.exec(v.secret),keys=Object.assign(Object.create(null),{[m?m[1]:'k1']:m?m[2]:v.secret}),seen=new Map();assert.equal(verifyCyclone(keys,v.header,v.method,v.path,Buffer.from(v.body),seen,v.t),true);assert.equal(verifyCyclone(keys,v.header,v.method,v.path,Buffer.from(v.body),seen,v.t),false);assert.equal(verifyCyclone(keys,v.header,v.method,v.path+'bad',Buffer.from(v.body),new Map(),v.t),false);}
});
test('HMAC auth, replay, wrong path, unknown port, malformed messages and durable envelope deduplication',async()=>{
  const f=await fixture();try{
    const e=f.envelope('x.id-generator.generate',{futureField:true});const p='/ports/x.id-generator.generate';
    assert.equal((await f.post(p,e,{signed:false})).status,401);assert.equal((await f.post(p,e,{key:'wrong'})).status,401);assert.equal((await f.post(p,e,{signPath:p+'/await'})).status,401);
    const raw=JSON.stringify(e),signature=sign(raw,p);assert.equal((await f.post(p,e,{signature})).status,202);assert.equal((await f.post(p,e,{signature})).status,401);assert.equal((await f.post(p,e)).body.duplicate,true);
    assert.equal((await f.post('/ports/log.line',{v:1,port:'log.line',runId:'run_test'})).status,404);assert.equal((await f.post(p,{...e,id:'another',port:'file.out'})).status,422);
    assert.equal(createStore(path.join(f.root,'control')).get(e.id).id,e.id);
    const secretless=JSON.stringify(f.plugin.store.all());assert.ok(!secretless.includes(secret));
  }finally{await f.cleanup();}
});
test('photo/generation idempotency, file delivery, run/request matching and retry with stable ID',async()=>{
  const f=await fixture();let callback,deliveries=[];
  const hub=http.createServer(async(req,res)=>{let text='';for await(const c of req)text+=c;deliveries.push({url:req.url,headers:req.headers,body:JSON.parse(text)});res.writeHead(deliveries.length===1?503:200,{'Content-Type':'application/json','Retry-After':'1'});res.end('{"accepted":true}');});
  await new Promise(r=>hub.listen(0,'127.0.0.1',r));callback=`http://127.0.0.1:${hub.address().port}`;
  try{
    const photo=f.envelope('file.out',{assetId:'photo-demo',name:'portrait.png'}, {artifactUrl:f.base+'/v1/ports/artifacts/photo?t=one-use'});
    assert.equal((await f.post('/ports/file.out',photo)).status,202);
    const generated=f.envelope('x.id-generator.generate',{requestId:'employee-demo',photoId:'photo-demo',employee,signature:{font:'paul-signature'},futureField:'ignored'});
    assert.equal((await f.post('/ports/x.id-generator.generate',generated)).status,202);assert.equal((await f.post('/ports/x.id-generator.generate',{...generated,id:'msg_retry'})).body.duplicate,true);
    for(let i=0;i<50&&f.jobs.size===0;i++)await delay(50);assert.equal(f.jobs.size,1);assert.equal(f.calls(),1);
    const wait={v:1,runId:'run_test',port:'file.in',awaitId:'aw_file',match:{requestId:'employee-demo',output:'front',futureHint:'ignore'},timeoutS:5,deliverUrl:callback+'/v1/ports/run_test/file.in/deliver',token:'test-token'};
    assert.equal((await f.post('/ports/file.in/await',wait)).status,202);assert.equal((await f.post('/ports/file.in/await',wait)).status,202);
    for(let i=0;i<80&&deliveries.length<2;i++)await delay(50);assert.equal(deliveries.length,2);assert.equal(deliveries[0].body.deliveryId,deliveries[1].body.deliveryId);assert.equal(deliveries[1].body.sha256,crypto.createHash('sha256').update(PNG).digest('hex'));assert.equal(deliveries[1].headers.authorization,'Port test-token');
    assert.ok(!JSON.stringify(f.plugin.store.all()).includes('test-token'));assert.ok(!fs.readFileSync(f.plugin.store.waitFile('run_test:file.in:aw_file'),'utf8').includes('test-token'));
    const other={...wait,runId:'other_run',awaitId:'aw_other',deliverUrl:callback+'/v1/ports/other_run/file.in/deliver'};await f.post('/ports/file.in/await',other);await delay(600);assert.equal(deliveries.length,2);
  }finally{await f.cleanup();await new Promise(r=>hub.close(r));}
});
test('repeated await preserves its deadline, cancel is durable, callback URL and owner origin are checked',async()=>{
  const f=await fixture();try{
    const w={v:1,runId:'run_test',port:'value.in',awaitId:'aw_wait',match:{requestId:'unknown',newKey:true},timeoutS:2,deliverUrl:f.base+'/v1/ports/run_test/value.in/deliver',token:'never-store-me'};
    await f.post('/ports/value.in/await',w);const key='run_test:value.in:aw_wait',expires=f.plugin.store.wait(key).expiresAt;await delay(30);await f.post('/ports/value.in/await',{...w,timeoutS:600});assert.equal(f.plugin.store.wait(key).expiresAt,expires);
    assert.equal((await f.post('/ports/value.in/await',{...w,awaitId:'aw_bad',deliverUrl:'http://example.com/v1/ports/run_test/value.in/deliver'})).status,422);
    assert.equal((await f.post('/ports/value.in/cancel',{v:1,runId:w.runId,port:w.port,awaitId:w.awaitId,reason:'stop'})).status,200);assert.equal(f.plugin.store.wait(key).status,'cancelled');await f.post('/ports/value.in/await',w);assert.equal(f.plugin.store.wait(key).status,'cancelled');
    const res=await fetch(f.base+'/api/id-generator/settings',{method:'PUT',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify(DEFAULTS)});assert.equal(res.status,403);
    const loaded=await fetch(f.base+'/api/id-generator/settings');const prefs=(await loaded.json()).settings;prefs.employee.city_of_birth='New City';const saved=await fetch(f.base+'/api/id-generator/settings',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':loaded.headers.get('etag')},body:JSON.stringify(prefs)});assert.equal(saved.status,200);assert.equal(createStore(path.join(f.root,'control')).settings().employee.city_of_birth,'New City');
  }finally{await f.cleanup();}
});
