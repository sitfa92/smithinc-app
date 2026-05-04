import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const files=['.env','.env.local','.env.production'];
const parse=s=>Object.fromEntries(s.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');let v=l.slice(i+1).trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);return [l.slice(0,i).trim(),v]}));
let env={};
for(const f of files){const p=path.join('/Users/smithincthefashionagency/smithinc-app',f);if(fs.existsSync(p))try{env={...env,...parse(fs.readFileSync(p,'utf8'))}}catch{}}
const url=env.VITE_SUPABASE_URL;
const key=env.VITE_SUPABASE_ANON_KEY;
if(!url||!key){console.log('ERROR: Missing env vars');process.exit(1)}
const supabase=createClient(url,key,{auth:{persistSession:false}});
const {data,error}=await supabase.from('models').select('id,name,email,status,submitted_at,created_at').ilike('name','%pesi%').order('submitted_at',{ascending:true});
if(error){console.log('Error:',error.message);process.exit(1)}
console.log('Matches:',data.length);
data.forEach(r=>console.log(JSON.stringify(r)));
