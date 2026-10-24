// Local-only browser acceptance test. All transcript text is synthetic.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const api = require('../scripts/transcripts-viewer.js');
test('desktop/mobile local import, search, safe rendering and clear', async () => {
 const root=path.join(__dirname,'..');
 const server=http.createServer((req,res)=>{
  const allowed={'/passages.html':'passages.html','/scripts/transcripts-viewer.js':'scripts/transcripts-viewer.js'};
  if(!allowed[req.url]){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(path.join(root,allowed[req.url])));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage(),errors=[],outside=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))outside.push(r.url());});
  await page.goto(`http://127.0.0.1:${server.address().port}/passages.html`);
  const source={source_id:'FKA-001',source_url:'https://example.org/synthetic',source_title:'Synthetic <img src=x onerror=alert(1)>',source_date:'2020',transcript_origin:'Invented fixture only',speaker:null};
  const passage={source_id:'FKA-001',start_ms:0,end_ms:1000,speaker:null,text:'Synthetic creativity <script>alert(1)</script>',review_status:'unreviewed',citation_url:'https://example.org/synthetic#t=0'};
  passage.passage_id=await api.identity(source.source_id,passage);
  const doc={schema_version:1,source,provenance:{transcript_sha256:'a'.repeat(64),method:'Synthetic test',importer_version:1},limitations:'Test only',passages:[passage]};
  await page.locator('#transcript-files').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  await page.waitForFunction(()=>document.querySelector('#import-status').textContent.includes('1 source(s)'));
  await page.locator('#passage-query').fill('creativity');await page.getByRole('button',{name:'Find passages by date'}).click();
  assert.equal(await page.locator('#passage-results article').count(),1);
  assert.equal(await page.locator('#passage-results script,#passage-results img').count(),0);
  assert.match(await page.locator('#passage-results blockquote').textContent(),/<script>/);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('button',{name:'Clear loaded files'}).click();assert.equal(await page.locator('#passage-results article').count(),0);
  doc.source.source_url='javascript:alert(1)';
  await page.locator('#transcript-files').setInputFiles({name:'unsafe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  await page.waitForFunction(()=>document.querySelector('#import-status').textContent.includes('Could not load files'));
  assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);
 } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
