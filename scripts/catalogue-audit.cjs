// Extract the existing catalogue without changing source identities or historical statuses.
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const html = fs.readFileSync('index.html','utf8');
const match = html.match(/const entries = (\[[\s\S]*?\n\]);/);
if (!match) throw new Error('Catalogue array not found');
const entries = vm.runInNewContext('(' + match[1] + ')', Object.create(null), {timeout:1000});
if (entries.length !== 132 || new Set(entries.map(e=>e.n)).size !== 132) throw new Error('Expected 132 unique legacy entry numbers');
function duration(raw){
 const s=raw.split('(')[0].trim();
 if (s==='—'||/CE/.test(s)) return null;
 if (/^\d+:\d{2}$/.test(s)) {const [m,sec]=s.split(':').map(Number);return m*60+sec;}
 let total=0, found=false;
 for(const [re,factor] of [[/(\d+(?:\.\d+)?)h\b/,3600],[/(\d+(?:\.\d+)?)m\b/,60],[/(\d+(?:\.\d+)?)s\b/,1]]){const m=s.match(re);if(m){total+=Number(m[1])*factor;found=true;}}
 return found?total:null;
}
const records=entries.map(e=>({...e,id:'FKA-'+String(e.n).padStart(3,'0'),date_year:(e.date.match(/\b(?:19|20)\d{2}\b/)||[])[0]||null,runtime_seconds:duration(e.runtime),runtime_is_approximate:e.runtime.startsWith('~'),status_recorded_date:'2026-08-29',status_basis:'Historical status copied from the existing catalogue; not a fresh playback check.'}));
const statuses={};for(const e of records) statuses[e.status]=(statuses[e.status]||0)+1;
const groups={};for(const e of records)if(e.url)(groups[e.url]??=[]).push(e.id);
const duplicateGroups=Object.entries(groups).filter(([,ids])=>ids.length>1).map(([url,ids])=>({url,source_ids:ids,disposition:'review_required; shared URL does not by itself prove identical works'}));
const years=records.map(e=>e.date_year).filter(Boolean).map(Number);
const sum=records.reduce((s,e)=>s+(e.runtime_seconds||0),0);
const report={schema_version:1,audit_date:'2026-10-24',method:'Structural audit of the committed catalogue. No automatic inference of current availability.',catalogue_array_sha256:crypto.createHash('sha256').update(match[1]).digest('hex'),entry_count:records.length,date_range:[Math.min(...years),Math.max(...years)],undated_count:records.filter(e=>!e.date_year).length,status_counts:statuses,null_url_count:records.filter(e=>!e.url).length,dead_with_url_count:records.filter(e=>e.status==='dead'&&e.url).length,dead_or_null_url_union_count:records.filter(e=>e.status==='dead'||!e.url).length,not_historically_live_count:records.filter(e=>e.status!=='live').length,parsed_runtime_seconds:sum,parsed_runtime_hours:Number((sum/3600).toFixed(4)),runtime_missing_or_non_duration_count:records.filter(e=>e.runtime_seconds===null).length,runtime_caveats:['Sum is listed full-recording runtime, not Fadiman speaking time.','Duplicates and shared URLs have not been removed.','CE credits are not treated as audio duration.','Approximate listed durations remain approximate.','Counts are catalogue records, not unique recordings.'],shared_url_groups:duplicateGroups};
if(process.argv.includes('--check')){
 const existing=JSON.parse(fs.readFileSync('data/catalogue.json','utf8'));
 if(JSON.stringify(existing)!==JSON.stringify({schema_version:1,source:'index.html entries array',records}))throw new Error('data/catalogue.json drift');
 console.log('PASS: 132 IDs and all legacy fields preserved; generated catalogue matches source');
}else{
 fs.writeFileSync('data/catalogue.json',JSON.stringify({schema_version:1,source:'index.html entries array',records},null,2)+'\n');
 fs.writeFileSync('data/research/catalogue-audit-2026-10-24.json',JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
