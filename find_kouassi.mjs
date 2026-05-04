import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const files=['.env','.env.local','.env.production'];
const parse=s=>Object.fromEntries(
  s.split(/\r?\n/)
    .map(l=>l.trim())
    .filter(l=>l && !l.startsWith('#') && l.includes('='))
    .map(l=>{const i=l.indexOf('=');let v=l.slice(i+1).trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);return [l.slice(0,i).trim(),v]})
);

let env={};
for(const f of files){
  const p=path.join(process.cwd(),f);
  if(fs.existsSync(p)){
    try{ env={...env,...parse(fs.readFileSync(p,'utf8'))}; }catch{}
  }
}

const url=process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const key=process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
if(!url || !key){
  console.error('Missing Supabase env vars: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase=createClient(url,key,{auth:{persistSession:false}});
const keywords=['kouassi','benedicta','kouassibenedicta46@gmail.com'];
const outputFields=['id','name','email','status','submitted_at','created_at','source','image_url','instagram'];

let all=[];
for(let from=0;from<100000;from+=1000){
  const {data,error}=await supabase.from('models').select('*').range(from,from+999);
  if(error){console.log('Error:',error.message);break}
  if(!data?.length)break;
  all.push(...data);
  if(data.length<1000)break;
}

console.log('Total models fetched:',all.length);

const matches=all.filter(row=>
  Object.values(row).some(v=>
    typeof v==='string' && keywords.some(k=>v.toLowerCase().includes(k))
  )
);

console.log('Candidate matches:',matches.length);
for(const r of matches){
  const out={};
  for(const f of outputFields) out[f]=r?.[f] ?? null;
  console.log(JSON.stringify(out));
}

const newest30=[...all]
  .sort((a,b)=>{
    const da=a?.submitted_at?Date.parse(a.submitted_at):NaN;
    const db=b?.submitted_at?Date.parse(b.submitted_at):NaN;
    if(!Number.isNaN(db) && !Number.isNaN(da)) return db-da;
    if(!Number.isNaN(db)) return 1;
    if(!Number.isNaN(da)) return -1;
    return 0;
  })
  .slice(0,30);

console.log('Newest 30 by submitted_at desc:');
for(const r of newest30){
  const out={};
  for(const f of outputFields) out[f]=r?.[f] ?? null;
  console.log(JSON.stringify(out));
}
