import { API_BASE } from './localApi';
export type PluginSettings = {
  version:1;enabled:boolean;retention_hours:number;
  employee:{country:string;doc_type:string;company_name:string;department:string;city_of_birth:string;company_location:string;height:string;export_format:string;generate_mockups:boolean};
  signature:{font:string;name_mode:string;text:string;scale:number;x:number;y:number};
  photo:{remove_background:boolean;zoom:number;x:number;y:number};
};
export async function pluginRequest(path:string,options:RequestInit={}){
  const res=await fetch(`${API_BASE}/api/id-generator/${path}`,options);const body=await res.json();
  if(!res.ok)throw Error(body.error?.message||'Plugin request failed.');return {body,etag:res.headers.get('ETag')||''};
}
