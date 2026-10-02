const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {jobContext,entryScript}=require('../worker/photoshop-dispatch.cjs');
function functions(file){const text=fs.readFileSync(path.join(__dirname,'../worker/scripts',file),'utf8');return text.slice(text.indexOf('function openSmartObjectDocument('),text.indexOf('\nfunction writeReport(',text.indexOf('function openSmartObjectDocument(')));}
for(const filename of ['run_employeeid_job.jsx','run_idcardprint_job.jsx']){
  test(filename+': waits for the child document and never edits an existing owner document',()=>{
    const parent={id:1},child={id:2},app={documents:[parent],activeDocument:parent,refresh(){if(++refreshes===3){this.documents.push(child);this.activeDocument=child;}}};let refreshes=0;
    const context={app,PREEXISTING_DOCUMENT_IDS:{},executeAction(){},stringIDToTypeID:x=>x,ActionDescriptor:function(){},DialogModes:{NO:0},$:{sleep(){}}};vm.createContext(context);vm.runInContext(functions(filename),context);
    assert.equal(context.openSmartObjectDocument(parent),child);assert.equal(refreshes,3);
    app.activeDocument=parent;app.refresh=()=>{app.activeDocument=child;};context.PREEXISTING_DOCUMENT_IDS[2]=true;
    assert.throws(()=>context.openSmartObjectDocument(parent),/already open/);
    app.activeDocument=parent;app.refresh=()=>{};
    assert.throws(()=>context.openSmartObjectDocument(parent),/did not open/);
  });
  test(filename+': failure cleanup keeps documents that were open before the job',()=>{
    const closed=[],owner={id:10,close(){closed.push(10);}},job={id:20,close(){closed.push(20);}};
    const context={app:{documents:[owner,job]},PREEXISTING_DOCUMENT_IDS:{10:true},SaveOptions:{DONOTSAVECHANGES:0}};vm.createContext(context);vm.runInContext(functions(filename),context);context.closeAllOpenDocumentsNoSave();assert.deepEqual(closed,[20]);
  });
}
test('delayed Photoshop entry skips terminal jobs and missing input, and isolates inputs for consecutive jobs',()=>{
  const paths={workerBase:'C:/private/worker',workerOutput:'C:/private/worker/output'};
  const first=jobContext(paths,'job-first'),second=jobContext(paths,'job-second');assert.notEqual(first.input_path,second.input_path);
  const files=new Set([first.input_path]);let executions=0;
  const context={File:function(filename){this.exists=files.has(filename);},$:{global:{},evalFile(){executions++;assert.equal(context.$.global.CYCLONE_JOB_CONTEXT.input_path,first.input_path);}}};vm.createContext(context);
  const entry=entryScript(first,'C:/private/worker/scripts/run_employeeid_job.jsx').replace(/^#target photoshop\n/,'');
  vm.runInContext(entry,context);assert.equal(executions,1);assert.equal(context.$.global.CYCLONE_JOB_CONTEXT,undefined);
  files.add(first.terminal_path);vm.runInContext(entry,context);assert.equal(executions,1);
  files.clear();vm.runInContext(entry,context);assert.equal(executions,1);
  assert.throws(()=>jobContext(paths,'../escape'));
});
