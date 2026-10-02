const path=require('node:path');
function jobContext(paths,jobId){
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(jobId))throw Error('Invalid worker job ID.');
  const folder=path.join(paths.workerOutput,jobId,'automation');
  const posix=value=>value.replace(/\\/g,'/');
  return {folder,base_path:posix(paths.workerBase),input_path:posix(path.join(folder,'input.json')),sidecar_path:posix(path.join(folder,'idcardprint_input.json')),terminal_path:posix(path.join(folder,'finished.json'))};
}
function entryScript(context,source){
  return '#target photoshop\n(function () {\n'+
    '  var context = '+JSON.stringify(context)+';\n'+
    '  if (new File(context.terminal_path).exists || !new File(context.input_path).exists) return;\n'+
    '  $.global.CYCLONE_JOB_CONTEXT = context;\n'+
    '  try { $.evalFile(new File('+JSON.stringify(source.replace(/\\/g,'/'))+')); }\n'+
    '  finally { delete $.global.CYCLONE_JOB_CONTEXT; }\n'+
    '}());\n';
}
module.exports={jobContext,entryScript};
