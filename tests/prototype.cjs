// Run: NODE_PATH="$CODEX_PRIMARY_RUNTIME_NODE_MODULES" node tests/prototype.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'));
  const server = http.createServer((req,res) => {
    const route=new URL(req.url,'http://localhost').pathname;
    if(route.startsWith('/data/')&&!route.includes('..')){
      try{res.setHeader('Content-Type','application/json');res.end(fs.readFileSync(path.join(__dirname,'..',route)));}catch{res.statusCode=404;res.end('{}');}
    }else{res.setHeader('Content-Type','text/html');res.end(html);}
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true});
    const page = await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    // The year selector, search and explorer must work without a chart CDN.
    await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    assert.equal(await page.locator('#corpus-tbody tr').count(),132);
    await page.locator('#bibliography-results article').first().waitFor();
    assert.equal(await page.locator('#bibliography-results article').count(),6);
    assert.equal(await page.locator('#gap-review-results article').count(),10);
    assert.ok(await page.locator('#recovery-results article').count()>0);
    assert.equal(await page.locator('#archive-tbody tr[id^="record-FKA-"]').count(),132);
    await page.fill('#search-input','zzzxxyyunknown');await page.click('#search-btn');
    assert.match(await page.locator('#search-result').innerText(),/No catalog records matched/);
    await page.fill('#search-input','FKA-001');await page.press('#search-input','Enter');
    assert.equal(await page.locator('#search-result article').count(),1);
    assert.match(await page.locator('#search-result').innerText(),/FKA-001/);
    await page.selectOption('#f-year','1968');
    assert.ok(await page.locator('#corpus-tbody tr').count()>0);
    await page.selectOption('#timeline-year','1968');
    assert.match(await page.locator('#timeline-entries').innerText(),/1968/);
    assert.ok(await page.locator('#timeline-entries a[href^="#record-FKA-"]').count()>0);
    await page.selectOption('#f-year','');await page.selectOption('#f-status','dead');
    assert.equal(await page.locator('#corpus-tbody tr').count(),63);
    await page.fill('#anno-input','The painting is complete.');await page.click('#anno-btn');
    assert.doesNotMatch(await page.locator('#anno-result').innerText(),/chronic pain/);
    await page.fill('#anno-input','<img src=x onerror="window.injected=true">');await page.click('#anno-btn');
    assert.equal(await page.evaluate(()=>window.injected),undefined);
    await page.locator('#search-chips button').first().focus();await page.keyboard.press('Enter');
    assert.match(await page.locator('#search-result').innerText(),/Ferriss/);
    assert.equal(await page.locator('#ca-contact').getAttribute('href'),'https://www.linkedin.com/in/rn-collins/');
    assert.equal(await page.locator('[onclick*="/api/lead"]').count(),0);
    for(const width of [390,1280]) {
      await page.setViewportSize({width,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`horizontal page overflow at ${width}px`);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: 132 records, source IDs, no-match search, 1968 timeline/filter, 63 historical dead-or-null records, annotation bounds, keyboard, contact fallback, mobile/desktop overflow, no JS errors.');
  } finally {if(browser) await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
