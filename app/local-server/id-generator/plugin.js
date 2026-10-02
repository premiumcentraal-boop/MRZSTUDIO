const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const {createStore,images,digest,FONTS}=require('./store');
const baseManifest=require('./cyclone-plugin.json');
const {loadJob,saveJob,createJobRecord,resolveOutputFile,mimeFor,emptyOutputs}=require('../jobs');
const model=require('./model.cjs');
const renderer=require('./render');
const CONTRACT='cyclone.ports/1', ENVELOPE_LIMIT=256*1024, FILE_LIMIT=20*1024*1024;
const OUTPUTS={front:'output_front_png_path',back:'output_back_png_path',full:'output_full_png_path',pdf:'output_pdf_path',psd:'output_psd_path',mockup1:'output_mockup_1_front_path',mockup2:'output_mockup_2_front_path',mockup3:'output_mockup_3_front_path'};
function error(status,code,message,retryable=false){return Object.assign(Error(message),{status,code,retryable});}
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(value);
function hubUrl(raw,kind){
  let u;try{u=new URL(raw);}catch{throw error(422,'invalid_url','Invalid hub URL.');}
  if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password||u.hash||!u.pathname.startsWith(kind==='artifact'?'/v1/artifacts/':'/v1/ports/')) throw error(422,'invalid_url','Only loopback Cyclone hub URLs are accepted.');
  return u;
}
async function boundedBody(req,limit){
  if(Number(req.headers['content-length'])>limit) throw error(413,'too_large','Request exceeds the contract limit.');
  const chunks=[];let size=0;const timer=setTimeout(()=>req.destroy(),10000);timer.unref();
  try{for await(const chunk of req){size+=chunk.length;if(size>limit) throw error(413,'too_large','Request exceeds the contract limit.');chunks.push(chunk);}return Buffer.concat(chunks);}finally{clearTimeout(timer);}
}
function imageMime(bytes){
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
  throw error(422,'invalid_photo','Employee photo must be a PNG, JPEG or WebP image.');
}
function schema(){
  const employeeProperties=Object.fromEntries(Object.entries(model.EMPLOYEE_DEFAULTS).map(([key,value])=>[key,typeof value==='boolean'?{type:'boolean'}:{type:'string',maxLength:100}]));
  Object.assign(employeeProperties,{
    first_name:{type:'string',minLength:1,maxLength:50},last_name:{type:'string',minLength:1,maxLength:50},
    company_name:{type:'string',maxLength:50},department:{type:'string',maxLength:50},city_of_birth:{type:'string',maxLength:50},company_location:{type:'string',maxLength:50},
    birth_date:{type:'string',format:'date'},valid_from:{type:'string',description:'ISO date; empty or omitted uses today.'},expires:{type:'string',description:'ISO date; empty or omitted uses the existing country and age validity rules.'},
    doc_number:{type:'string',description:'Empty generates using the selected country rules; supplied values are validated.'},personal_number:{type:'string',description:'Empty generates using the selected country rules; supplied values are validated.'},
    country:{enum:['NL','DE','OTHER']},doc_type:{enum:['id_card','passport']},gender:{enum:['M','F','X']},export_format:{enum:['png','pdf','psd']},mrz_format:{enum:['auto','td1','td3']},mrz_method:{const:'icao9303'},
    height:{type:'string',pattern:'^[12],[0-9]{2} m$',description:'1,40–2,10 m; height_cm takes precedence.'},height_cm:{type:'integer',minimum:140,maximum:210},
    issuer_code:{type:'string',pattern:'^[A-Z<]{3}$'},nationality_code:{type:'string',pattern:'^[A-Z<]{3}$'},
  });
  return {
  contract:CONTRACT,name:'id-generator',version:baseManifest.version,
  workflow:['Emit file.out with data.assetId and the employee photo artifactUrl.','Emit x.id-generator.generate with requestId, photoId and employee.','Await value.in with match.requestId for completion or failure.','Await file.in with match.requestId and match.output for each generated file.'],
  generate:{port:'x.id-generator.generate',data:{requestId:'employee-demo',photoId:'photo-demo',employee:{first_name:'Sam',last_name:'Example',birth_date:'1990-06-14',valid_from:'2026-10-01',doc_number:'',personal_number:'',height_cm:172,city_of_birth:'Zoetermeer'},signature:{font:'paul-signature',name_mode:'first_name_only'},photo:{remove_background:true,zoom:1,x:0.5,y:0.5}}},
  employeeFields:Object.keys(model.EMPLOYEE_DEFAULTS).concat('height_cm'),
  schema:{$schema:'https://json-schema.org/draft/2020-12/schema',type:'object',required:['requestId','photoId','employee'],properties:{requestId:{type:'string',pattern:'^[A-Za-z0-9_-]{1,80}$'},photoId:{type:'string',pattern:'^[A-Za-z0-9_-]{1,80}$'},employee:{type:'object',required:['first_name','last_name','birth_date'],properties:employeeProperties},signature:{type:'object',properties:{font:{enum:FONTS},name_mode:{enum:['first_name_only','full_name','custom']},text:{type:'string',maxLength:40,description:'Required and nonempty for custom name mode.'},scale:{type:'number',minimum:0.5,maximum:3},x:{type:'number',minimum:-210,maximum:210},y:{type:'number',minimum:-61,maximum:61}}},photo:{type:'object',properties:{remove_background:{type:'boolean'},zoom:{type:'number',minimum:1,maximum:5},x:{type:'number',minimum:0,maximum:1},y:{type:'number',minimum:0,maximum:1}}}}},
  cities:model.CITY_PRESETS,customCities:true,signature:{fonts:FONTS,default:'paul-signature',nameModes:['first_name_only','full_name','custom'],width:420,height:123},photo:{width:2421,height:3292,formats:['image/png','image/jpeg','image/webp'],localBackgroundRemoval:true},outputs:Object.keys(OUTPUTS),limits:{envelopeBytes:ENVELOPE_LIMIT,fileBytes:FILE_LIMIT,awaitSeconds:600},
};}
function createPlugin({control,paths,apiPort=8787,uiPort=5173,health,render=renderer.render,load=loadJob,resolve=resolveOutputFile,publish}={}){
  const store=createStore(control), uiBase=`http://127.0.0.1:${uiPort}`;
  const manifest={...baseManifest,endpoint:`http://127.0.0.1:${apiPort}`,ui:{panelUrl:`${uiBase}/plugins/id-generator?embed=1`,settingsUrl:`${uiBase}/settings/id-generator`},schemaUrl:`http://127.0.0.1:${apiPort}/api/id-generator/schema`};
  const verifyPromise=import('./vendor/verify.mjs');
  let keys=Object.create(null), configured=false, closing=false, active=false;
  const replays=new Map(Object.entries(store.read(path.join(store.root,'replays.json'),{}))), waits=new Map();
  function refreshKeys(){keys=Object.create(null);for(const raw of [store.secret(),process.env.CYCLONE_PLUGIN_SECRET_NEXT]){if(!raw)continue;const m=/^(k\d+)\.(.+)$/.exec(raw);keys[m?m[1]:'k1']=m?m[2]:raw;}configured=Object.keys(keys).length>0;}
  refreshKeys();
  function send(res,status,body,headers={}){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(body));}
  function records(run){return store.all().filter(r=>r.port==='x.id-generator.generate'&&r.runId===run&&!r.alias);}
  function snapshot(record){
    if(!record)return null;const found=record.jobId?load(record.jobId):null, job=found?.job;
    return {requestId:record.requestId,jobId:record.jobId||null,status:record.status==='failed'?'failed':record.status==='expired'?'expired':job?.status||record.status,error:record.error|| (job?.status==='failed'?'The Photoshop worker could not generate this ID. Check the local Studio job.':null),mrz:record.mrz||null,outputs:job?Object.entries(OUTPUTS).filter(([,k])=>job[k]).map(([output,k])=>({output,mime:mimeFor(job[k])})):[]};
  }
  async function fetchPhoto(record,url){
    try{
      const response=await fetch(hubUrl(url,'artifact'),{signal:AbortSignal.timeout(20000),redirect:'error'});
      if(!response.ok)throw Error('Photo artifact unavailable. Send a fresh photo artifact.');
      if(Number(response.headers.get('content-length'))>FILE_LIMIT)throw Error('Employee photo exceeds 20 MB.');
      const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>FILE_LIMIT)throw Error('Employee photo exceeds 20 MB.');chunks.push(chunk);}
      const bytes=Buffer.concat(chunks);record.mime=imageMime(bytes);
      fs.writeFileSync(path.join(store.photos,digest(record.id)+'.bin'),bytes,{mode:0o600});record.status='ready';record.bytes=bytes.length;
    }catch{record.status='failed';record.error='Photo could not be received or decoded. Send a new photo with a fresh asset ID.';}
    store.put(record);void pump();
  }
  async function generate(record,photo){
    const settings=store.settings();
    try{
      const form=model.normalizeEmployee(record.employee,settings.employee);
      const transforms=images({...settings.signature,...record.signature},{...settings.photo,...record.photo});
      const signatureText=transforms.signature.name_mode==='custom'?transforms.signature.text:transforms.signature.name_mode==='full_name'?`${form.first_name} ${form.last_name}`:form.first_name;
      const bytes=fs.readFileSync(path.join(store.photos,digest(photo.id)+'.bin'));
      const assets=await render({photo:bytes.toString('base64'),mime:photo.mime,signatureText,signature:transforms.signature,photoSettings:transforms.photo},uiBase);
      if(closing)return;
      const payload=model.employeePayload(form);payload.assets={employee_photo_path:'photo.png',signature_image_path:'signature.png'};
      payload.meta.created_from='cyclone-ports/id-generator';
      // Reserve the job ID before publishing. A crash/retry can never enqueue a second job.
      if(!record.jobId){record.jobId=crypto.randomUUID();store.put(record);}
      if(!load(record.jobId)){
        const job={...createJobRecord({payload,photoName:'photo.png',signatureName:'signature.png'}),id:record.jobId};
        if(publish)await publish(job,assets);
        else{
          const folder=path.join(paths.incoming,job.id);fs.mkdirSync(folder,{recursive:true});
          fs.writeFileSync(path.join(folder,'photo.png'),assets.photo);fs.writeFileSync(path.join(folder,'signature.png'),assets.signature);saveJob('incoming',job);
        }
      }
      record.status='queued';record.mrz=payload.mrz;
    }catch{if(closing)return;record.status='failed';record.error='Generation could not start. Check the employee fields, photo, local renderer and worker readiness.';}
    delete record.employee;delete record.signature;delete record.photo;store.put(record);
  }
  async function pump(){
    if(active||closing)return;active=true;
    try{
      const all=store.all();
      for(const record of all.filter(r=>r.port==='x.id-generator.generate'&&r.status==='received'&&!r.alias)){
        if(closing)break;
        if(record.jobId&&load(record.jobId)){record.status='queued';record.mrz=load(record.jobId).job.input_json?.mrz;delete record.employee;delete record.signature;delete record.photo;store.put(record);continue;}
        const photo=all.find(p=>p.port==='file.out'&&p.runId===record.runId&&p.assetId===record.photoId);
        if(photo?.status==='ready')await generate(record,photo);
        else if(photo?.status==='failed'||Date.now()-record.createdAt>120000){record.status='failed';record.error='Employee photo is missing or failed. Send a new photo and generation request.';store.put(record);}
      }
      for(const wait of waits.values())void tryDeliver(wait);
      expire(all);
    }finally{active=false;}
  }
  function expire(all){
    const cutoff=Date.now()-store.settings().retention_hours*3600000;
    for(const r of all){
      if(r.createdAt>=cutoff||r.status==='expired'||r.alias)continue;
      if(r.port==='file.out'){fs.rmSync(path.join(store.photos,digest(r.id)+'.bin'),{force:true});r.status='expired';store.put(r);}
      else if(r.port==='x.id-generator.generate'){
        const found=r.jobId?load(r.jobId):null;if(found&&['incoming','processing'].includes(found.stage))continue;
        if(r.jobId){for(const root of [paths.done,paths.failed,paths.output,paths.workerOutput].filter(Boolean)){const target=path.resolve(root,r.jobId);if(path.dirname(target)!==path.resolve(root)||!id(r.jobId)|| (fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink()))throw Error('Unsafe plugin cleanup target.');if(fs.existsSync(target))fs.rmSync(target,{recursive:true,force:true});}}
        if(r.jobId&&paths.workerLogs&&fs.existsSync(paths.workerLogs)){
          for(const name of fs.readdirSync(paths.workerLogs)){if(!name.endsWith('_'+r.jobId+'.log'))continue;const target=path.join(paths.workerLogs,name);if(!fs.lstatSync(target).isSymbolicLink()&&fs.lstatSync(target).isFile())fs.rmSync(target,{force:true});}
        }
        if(paths.workerCurrentJob && paths.root){
          const work=path.resolve(paths.workerCurrentJob),current=store.read(path.join(work,'input.json'),null),heartbeat=paths.heartbeat?store.read(paths.heartbeat,null):null;
          if(current?.job_id===r.jobId && !heartbeat?.current_job_id){
            if(!work.startsWith(path.resolve(paths.root)+path.sep)||fs.lstatSync(work).isSymbolicLink())throw Error('Unsafe worker cleanup target.');
            for(const name of fs.readdirSync(work)){const target=path.join(work,name);if(!fs.lstatSync(target).isDirectory()&&!fs.lstatSync(target).isSymbolicLink())fs.rmSync(target,{force:true});}
          }
        }
        for(const k of ['employee','signature','photo','mrz','error','finalSnapshot'])delete r[k];r.status='expired';store.put(r);
      }
    }
  }
  function finishWait(wait,status){wait.controller?.abort();wait.status=status;store.putWait(wait.key,{runId:wait.runId,port:wait.port,awaitId:wait.awaitId,expiresAt:wait.expiresAt,deliveryId:wait.deliveryId,status});waits.delete(wait.key);}
  async function tryDeliver(wait){
    if(wait.busy||closing)return;
    if(Date.now()>=wait.expiresAt){finishWait(wait,'expired');return;}
    if(wait.nextAt && Date.now()<wait.nextAt)return;
    let body;
    if(wait.port==='value.in'&&wait.match.ask==='schema')body={v:1,deliveryId:wait.deliveryId,value:schema()};
    else{
      const candidates=records(wait.runId).filter(r=>!wait.match.requestId||r.requestId===wait.match.requestId);
      // Require explicit correlation whenever this run has multiple generation requests.
      if(candidates.length!==1)return;
      const r=candidates[0], state=snapshot(r);
      if(wait.port==='value.in'){
        if(!['complete','failed','expired'].includes(state.status)&&wait.match.ask!=='status')return;
        if(['complete','failed','expired'].includes(state.status)&&!r.finalSnapshot){r.finalSnapshot=state;store.put(r);}
        body={v:1,deliveryId:wait.deliveryId,value:r.finalSnapshot||state};
      }else{
        if(state.status!=='complete')return;
        const job=load(r.jobId)?.job, output=wait.match.output|| (wait.match.kind==='pdf'?'pdf':job?.input_json?.export_format==='png'?'front':job?.input_json?.export_format);
        const field=OUTPUTS[output];if(!field||!job?.[field])return;
        const file=resolve(r.jobId,path.basename(job[field]));if(!file)return;
        const size=fs.statSync(file).size;if(size>FILE_LIMIT){finishWait(wait,'too_large');return;}
        const mime=mimeFor(file);
        if(wait.match.kind&&wait.match.kind!=='image'&&wait.match.kind!=='pdf'&&wait.match.kind!=='psd'){} // Unknown hint: ignore.
        else if(wait.match.kind==='image'&&!mime.startsWith('image/')||wait.match.kind==='pdf'&&mime!=='application/pdf'||wait.match.kind==='psd'&&output!=='psd')return;
        const bytes=fs.readFileSync(file);body={v:1,deliveryId:wait.deliveryId,name:path.basename(file),mime,base64:bytes.toString('base64'),sha256:digest(bytes)};
      }
    }
    wait.busy=true;wait.controller=new AbortController();
    try{
      const headers={'Authorization':`Port ${wait.token}`,'Content-Type':'application/json','X-Cyclone-Contract':CONTRACT};if(wait.traceparent)headers.traceparent=wait.traceparent;
      const response=await fetch(wait.deliverUrl,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.any([wait.controller.signal,AbortSignal.timeout(Math.min(10000,Math.max(1,wait.expiresAt-Date.now())))]),redirect:'error'});
      if(!waits.has(wait.key))return;
      if(response.status===200){finishWait(wait,'delivered');return;}
      if(response.status===429||response.status>=500){const raw=response.headers.get('retry-after');const seconds=Number(raw);wait.nextAt=Date.now()+Math.max(250,raw?(Number.isFinite(seconds)?seconds*1000:Date.parse(raw)-Date.now()):1000*2**Math.min(wait.attempt++,5));}
      else{finishWait(wait,'refused');return;}
    }catch{wait.nextAt=Date.now()+1000*2**Math.min(wait.attempt++,5);}
    finally{wait.busy=false;wait.controller=null;}
  }
  const timer=setInterval(()=>{for(const w of waits.values()){if(Date.now()>=w.expiresAt)finishWait(w,'expired');else if(!w.nextAt||Date.now()>=w.nextAt)void tryDeliver(w);}void pump().catch(()=>{});},500);timer.unref();
  // Unfetched one-use URLs cannot be recovered after a crash. Surface a fresh-photo request.
  for(const r of store.all())if(r.port==='file.out'&&r.status==='received'){r.status='failed';store.put(r);}
  function owner(req){
    const origin=req.headers.origin;
    if(origin&&![uiBase,`http://localhost:${uiPort}`,manifest.endpoint].includes(origin)||req.headers['sec-fetch-site']==='cross-site')throw error(403,'origin_refused','Open plugin settings from the local Studio.');
    if(!String(req.headers['content-type']).startsWith('application/json'))throw error(415,'json_required','Use application/json.');
  }
  async function handle(req,res){
    const url=new URL(req.url,manifest.endpoint), name=url.pathname;
    if(name==='/cyclone-plugin.json'&&req.method==='GET'){send(res,200,manifest);return true;}
    if(!name.startsWith('/ports/')&&!name.startsWith('/api/id-generator/'))return false;
    try{
      if(name.startsWith('/api/id-generator/')){
        if(req.method==='GET'){
          if(name==='/api/id-generator/schema')send(res,200,schema());
          else if(name==='/api/id-generator/settings')send(res,200,{settings:store.settings(),configured,manifest,health:health?.()},{ETag:store.revision()});
          else if(name==='/api/id-generator/requests')send(res,200,{requests:store.all().filter(r=>r.port==='x.id-generator.generate'&&!r.alias).slice(-30).map(snapshot)});
          else throw error(404,'not_found','Unknown plugin route.');return true;
        }
        if(req.method!=='PUT')throw error(405,'method_not_allowed','Use GET or PUT.');owner(req);
        const body=JSON.parse((await boundedBody(req,64*1024)).toString());
        if(name==='/api/id-generator/settings'){const saved=store.saveSettings(body,req.headers['if-match']);send(res,200,{settings:saved,configured,manifest},{ETag:store.revision()});}
        else if(name==='/api/id-generator/pair'){store.secret(body.secret);refreshKeys();send(res,200,{configured});}
        else throw error(404,'not_found','Unknown plugin route.');return true;
      }
      if(req.method!=='POST')throw error(405,'method_not_allowed','Ports accept POST.');
      const raw=await boundedBody(req,ENVELOPE_LIMIT);
      for(const [key,expires]of replays)if(expires<Date.now()/1000)replays.delete(key);
      if(replays.size>20000)throw error(429,'busy','Plugin is busy.',true);
      const {verifyCyclone}=await verifyPromise;
      if(!verifyCyclone(keys,req.headers['x-cyclone-signature'],'POST',req.url,raw,replays))throw error(401,'bad_signature','Valid Cyclone signature required.');
      store.write(path.join(store.root,'replays.json'),Object.fromEntries(replays));
      if(req.headers['x-cyclone-contract']&&req.headers['x-cyclone-contract']!==CONTRACT)throw error(422,'contract_mismatch','Expected cyclone.ports/1.');
      const route=/^\/ports\/([a-z0-9.-]+)(\/await|\/cancel)?$/.exec(name);
      const port=route?.[1], action=route?.[2]||'', way=manifest.serves.find(s=>s.port===port)?.way;
      if(!way)throw error(404,'port_not_served','This port is not served.');
      const body=JSON.parse(raw.toString());
      if(!body||body.v!==1||body.port!==port||!id(body.runId))throw error(422,'invalid','Invalid port request structure.');
      if(way==='out'&&!action){
        if(!id(body.id)||body.way!=='out'||!Number.isInteger(body.seq)||typeof body.sentAt!=='string'||typeof body.sensitivity!=='string'||!body.data||typeof body.data!=='object'||Array.isArray(body.data))throw error(422,'invalid','Invalid envelope structure.');
        const old=store.get(body.id), hash=digest(raw);
        if(old){if(old.digest!==hash)throw error(409,'id_conflict','Envelope ID was used for different data.');send(res,202,{received:true,duplicate:true});return true;}
        if(!store.settings().enabled||closing)throw error(503,'disabled','ID Generator is paused.',true);
        const all=store.all();if(all.filter(r=>r.status==='received').length>=20)throw error(429,'busy','Generation queue is full.',true);
        const record={id:body.id,runId:body.runId,port,digest:hash,createdAt:Date.now(),status:'received'};
        if(port==='file.out'){
          record.assetId=id(body.data.assetId)?body.data.assetId:body.id;
          if(all.some(r=>r.port==='file.out'&&r.runId===record.runId&&r.assetId===record.assetId))throw error(409,'asset_conflict','Choose a new photo asset ID.');
          if(!body.artifactUrl){record.status='failed';record.error='Employee photo artifact is missing.';}
          else hubUrl(body.artifactUrl,'artifact');
        }else{
          record.requestId=id(body.data.requestId)?body.data.requestId:body.id;record.photoId=body.data.photoId;
          const previous=all.find(r=>r.port===port&&r.runId===record.runId&&r.requestId===record.requestId&&!r.alias);
          if(previous){record.alias=previous.id;record.status='duplicate';}
          else if(!id(record.photoId)||!body.data.employee){record.status='failed';record.error='Provide photoId and employee fields from the schema.';}
          else{
            try{record.employee=model.normalizeEmployee(body.data.employee,store.settings().employee);const transforms=images({...store.settings().signature,...body.data.signature},{...store.settings().photo,...body.data.photo});record.signature=transforms.signature;record.photo=transforms.photo;}catch(e){record.status='failed';record.error=e.message;}
          }
        }
        store.put(record);send(res,202,{received:true,...(record.alias?{duplicate:true}:{})});
        setImmediate(()=>{if(record.port==='file.out'&&record.status==='received')void fetchPhoto(record,body.artifactUrl).catch(()=>{});else void pump().catch(()=>{});});return true;
      }
      if(way!=='in'||!['/await','/cancel'].includes(action))throw error(404,'port_not_served','Port direction is not served.');
      if(!id(body.awaitId))throw error(422,'invalid','awaitId is required.');
      const key=[body.runId,port,body.awaitId].join(':');
      if(action==='/cancel'){const w=waits.get(key);if(w)finishWait(w,'cancelled');else store.putWait(key,{runId:body.runId,port,awaitId:body.awaitId,status:'cancelled'});send(res,200,{cancelled:true});return true;}
      if(!body.match||typeof body.match!=='object'||Array.isArray(body.match)||!Number.isFinite(body.timeoutS)||body.timeoutS<=0||body.timeoutS>600||typeof body.token!=='string'||!body.token||body.token.length>2048||/[\x00-\x1f]/.test(body.token))throw error(422,'invalid','Invalid await structure.');
      const callback=hubUrl(body.deliverUrl,'deliver');
      if(callback.pathname!==`/v1/ports/${body.runId}/${port}/deliver`||callback.search)throw error(422,'invalid_url','Callback does not match the run and port.');
      const old=store.wait(key);
      if(old&&old.status!=='waiting'){send(res,202,{accepted:true,duplicate:true});return true;}
      if(!waits.has(key)&&waits.size>=100)throw error(429,'busy','Too many waits.',true);
      const wait=waits.get(key)||{key,runId:body.runId,port,awaitId:body.awaitId,match:body.match,expiresAt:old?.expiresAt||Date.now()+body.timeoutS*1000,deliveryId:old?.deliveryId||'dl_'+crypto.randomBytes(12).toString('hex'),status:'waiting',attempt:0};
      wait.deliverUrl=callback.href;wait.token=body.token;
      wait.traceparent=/^00-[a-f0-9]{32}-[a-f0-9]{16}-[a-f0-9]{2}$/.test(req.headers.traceparent||'')?req.headers.traceparent:null;
      waits.set(key,wait);store.putWait(key,{runId:wait.runId,port,awaitId:wait.awaitId,expiresAt:wait.expiresAt,deliveryId:wait.deliveryId,status:'waiting'});
      send(res,202,{accepted:true,...(old?{duplicate:true}:{})});setImmediate(()=>void tryDeliver(wait));return true;
    }catch(e){send(res,e.status||400,{error:{code:e.code||'invalid',message:e.status?e.message:'Request could not be parsed.',retryable:!!e.retryable}},e.status===429?{'Retry-After':'2'}:{});return true;}
  }
  async function close(){closing=true;clearInterval(timer);for(const w of waits.values())w.controller?.abort();await renderer.close();}
  function trackPanelJob(job){store.put({id:job.id,runId:'local_panel',port:'x.id-generator.generate',digest:digest(job.id),createdAt:Date.now(),status:'queued',requestId:job.id,jobId:job.id,mrz:job.input_json?.mrz});}
  return {handle,close,manifest,store,snapshot,pump,schema,trackPanelJob};
}
module.exports={createPlugin,schema,boundedBody,hubUrl,imageMime,CONTRACT};
