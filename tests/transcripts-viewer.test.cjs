// Synthetic data only. No example quotation is from James Fadiman.
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../scripts/transcripts-viewer.js');
async function fixture() {
  const source = {source_id:'FKA-001',source_url:'https://example.org/synthetic',source_title:'<img src=x onerror=alert(1)>',source_date:'2020-06',transcript_origin:'Synthetic test only',speaker:null};
  const passage = {source_id:source.source_id,start_ms:1000,end_ms:2000,speaker:null,text:'<script>alert(1)</script> creativity',review_status:'unreviewed',citation_url:'https://example.org/synthetic#t=1'};
  passage.passage_id = await api.identity(source.source_id,passage);
  return {schema_version:1,source,provenance:{transcript_sha256:'a'.repeat(64),method:'Synthetic fixture only',importer_version:1},limitations:'Synthetic test only.',passages:[passage]};
}
test('valid fixture retains source and unknown speaker; literal search',async()=>{
  const d = await api.validate(await fixture());
  assert.equal(api.search([d],'CREATIVITY').length,1);
  assert.equal(api.search([d],'absent').length,0);
  assert.equal(d.passages[0].speaker,null);
});
test('unsafe protocols, credentials and control characters fail',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,hi','https://user:secret@example.org','https://example.org/\n','ftp://example.org','//example.org']) assert.throws(()=>api.safeURL(url));
});
test('tampered text, source, intervals, approval and locator fail',async()=>{
  for(const [key,value] of [['text','Changed'],['source_id','FKA-002'],['end_ms',1000],['start_ms',NaN],['citation_url','https://example.org/other#t=1'],['review_status','approved']]) {
    const d=await fixture();d.passages[0][key]=value;await assert.rejects(api.validate(d));
  }
});
test('invalid provenance and impossible dates fail',async()=>{
  const d=await fixture();d.provenance.transcript_sha256='no';await assert.rejects(api.validate(d));
  for(const date of ['2020-00','2020-02-30','0000','2020-13','2020-06-00']) {const x=await fixture();x.source.source_date=date;await assert.rejects(api.validate(x));}
});
test('duplicate passage identity rejected',async()=>{
  const d=await fixture();d.passages.push({...d.passages[0]});await assert.rejects(api.validate(d));
});
test('render uses text nodes exclusively and guards links',async()=>{
  const d=await api.validate(await fixture());
  class Element {
    constructor(tag){this.tag=tag;this.children=[];this.textContent='';}
    append(child){this.children.push(child);}
    replaceChildren(){this.children=[];}
    set innerHTML(_){throw new Error('Untrusted HTML must never be interpreted');}
  }
  const document={createElement:tag=>new Element(tag)},container=new Element('div');
  api.render(document,container,api.search([d],'creativity'));
  const article=container.children[0];
  assert.match(article.children[0].textContent,/<img src=x/);
  assert.match(article.children[2].textContent,/<script>/);
  assert.equal(article.children.at(-1).rel,'noopener noreferrer');
  assert.throws(()=>api.render(document,container,[{...d.passages[0],source:d.source,citation_url:'javascript:alert(1)'}]));
});
test('Python importer and browser hash/citation agree',async()=>{
  const {execFileSync}=require('node:child_process');
  const code="import json,sys;sys.path.insert(0,'scripts');import transcripts;print(json.dumps(transcripts.parse_transcript('00:00.000 --> 00:01.000\\nSynthetic creativity 🌱.',{'source_id':'FKA-001','source_url':'https://www.youtube.com/watch?v=synthetic&t=999','source_title':'Synthetic only','source_date':'2020','transcript_origin':'Synthetic fixture','speaker':None})))";
  const d=JSON.parse(execFileSync('python3',['-c',code],{cwd:require('node:path').join(__dirname,'..'),encoding:'utf8'}));
  await api.validate(d);assert.equal(api.search([d],'creativity').length,1);
});
