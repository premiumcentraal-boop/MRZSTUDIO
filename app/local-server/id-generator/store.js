const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {write} = require('../../../scripts/atomic-json.cjs');
const {execFileSync} = require('node:child_process');
const DEFAULTS = {
  version:1, enabled:true, retention_hours:24,
  employee:{country:'NL',doc_type:'id_card',company_name:'Acme Corporation',department:'Engineering',city_of_birth:'Zoetermeer',company_location:'Burg. van Zoetermeer',height:'1,72 m',export_format:'png',generate_mockups:false},
  signature:{font:'paul-signature',name_mode:'first_name_only',text:'',scale:1,x:0,y:0},
  photo:{remove_background:true,zoom:1,x:0.5,y:0.5},
};
const FONTS = ['paul-signature','testimonia','royalty','taylor-swift','caramellia','stay-classy','ronde-royal','rightman-signature','dwayne-dylan'];
const digest = value => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const read = (file,fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : fallback;
const fail = message => {throw Object.assign(Error(message),{status:422,code:'invalid_settings'});};
function images(signature,photo) {
  const sig = {...DEFAULTS.signature,...signature}, crop={...DEFAULTS.photo,...photo};
  if (!FONTS.includes(sig.font) || !['first_name_only','full_name','custom'].includes(sig.name_mode) || typeof sig.text !== 'string' || sig.text.length>40 || /[\x00-\x1f]/.test(sig.text) || (sig.name_mode==='custom'&&!sig.text.trim())) fail('Choose a bundled signature font and a valid name mode.');
  if (!Number.isFinite(sig.scale)||sig.scale<0.5||sig.scale>3||!Number.isFinite(sig.x)||Math.abs(sig.x)>210||!Number.isFinite(sig.y)||Math.abs(sig.y)>61) fail('Invalid signature placement.');
  if(typeof crop.remove_background!=='boolean'||!Number.isFinite(crop.zoom)||crop.zoom<1||crop.zoom>5||!Number.isFinite(crop.x)||crop.x<0||crop.x>1||!Number.isFinite(crop.y)||crop.y<0||crop.y>1) fail('Invalid photo crop.');
  return {signature:Object.fromEntries(Object.keys(DEFAULTS.signature).map(k=>[k,sig[k]])),photo:Object.fromEntries(Object.keys(DEFAULTS.photo).map(k=>[k,crop[k]]))};
}
function validateSettings(value) {
  if (!value || value.version!==1 || typeof value.enabled!=='boolean' || !Number.isInteger(value.retention_hours) || value.retention_hours<1 || value.retention_hours>168 || !value.employee || typeof value.employee!=='object') fail('Invalid plugin settings.');
  const employee={...DEFAULTS.employee};
  for (const k of Object.keys(employee)) {
    if(value.employee[k]===undefined) continue;
    if(typeof value.employee[k]!==typeof employee[k] || (typeof value.employee[k]==='string'&&(value.employee[k].length>50||/[\x00-\x1f]/.test(value.employee[k])))) fail(`Invalid ${k}.`);
    employee[k]=value.employee[k];
  }
  if(!['NL','DE','OTHER'].includes(employee.country)||!['id_card','passport'].includes(employee.doc_type)||!['png','pdf','psd'].includes(employee.export_format)||!employee.company_name.trim()||!employee.city_of_birth.trim()) fail('Choose a country, document layout, city and company.');
  const height=Number(employee.height.replace(',','.').replace(' m','')); if(!/^[12],[0-9]{2} m$/.test(employee.height)||height<1.4||height>2.1) fail('Height must be 1,40–2,10 m.');
  return {version:1,enabled:value.enabled,retention_hours:value.retention_hours,employee,...images(value.signature,value.photo)};
}
function createStore(control) {
  const root=path.join(control,'id-generator'), receipts=path.join(root,'receipts'), photos=path.join(root,'photos'), waits=path.join(root,'waits');
  for(const dir of [root,receipts,photos,waits]) fs.mkdirSync(dir,{recursive:true});
  const prefs=path.join(root,'settings.json'); if(!fs.existsSync(prefs)) write(prefs,DEFAULTS);
  const index=new Map(fs.readdirSync(receipts).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).map(n=>{const r=read(path.join(receipts,n));return [r.id,r];}));
  return {
    root,photos,read,write,digest,
    settings:()=>validateSettings(read(prefs)),
    revision:()=> '"'+digest(read(prefs))+'"',
    saveSettings(value,etag){if(etag!==this.revision()) throw Object.assign(Error('Settings changed. Reload before saving.'),{status:412,code:'settings_changed'});write(prefs,validateSettings(value));return this.settings();},
    file:id=>path.join(receipts,digest(id)+'.json'),
    get(id){return index.get(id)||null;},
    put(record){write(this.file(record.id),record);index.set(record.id,record);},
    all(){return [...index.values()];},
    waitFile:id=>path.join(waits,digest(id)+'.json'),
    wait(id){return read(this.waitFile(id),null);},
    putWait(id,value){write(this.waitFile(id),value);},
    secret(value){
      const keyFile=path.join(root,'auth.json');
      if(value!==undefined){
        if(typeof value!=='string'||value.length<16||value.length>512||/[\s\x00-\x1f]/.test(value)) fail('Paste the plugin secret supplied by Glass (at least 16 characters).');
        if(process.platform!=='win32') fail('Use CYCLONE_PLUGIN_SECRET on this platform.');
        const encoded=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Add-Type -AssemblyName System.Security; $bytes=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd()); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))'],{input:value,encoding:'utf8',windowsHide:true});
        write(keyFile,{dpapi:encoded.trim()});
      }
      if(process.env.CYCLONE_PLUGIN_SECRET) return process.env.CYCLONE_PLUGIN_SECRET;
      const saved=read(keyFile,null); if(!saved) return '';
      return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Add-Type -AssemblyName System.Security; $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))'],{input:saved.dpapi,encoding:'utf8',windowsHide:true}).trim();
    },
  };
}
module.exports={createStore,DEFAULTS,FONTS,images,digest};
