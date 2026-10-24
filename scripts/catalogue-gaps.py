"""Extract existing gap rows as candidates, preserving historical IDs, without promoting claims."""
import json,re,html,sys
from pathlib import Path
s=Path('index.html').read_text()
table=re.search(r'<table class="gap-table">(.*?)</table>',s,re.S).group(1)
def clean(x):return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',x))).strip()
rows=[]
for row in re.findall(r'<tr>(.*?)</tr>',table,re.S):
 cells=re.findall(r'<td>(.*?)</td>',row,re.S)
 if not cells:continue
 texts=list(map(clean,cells)); urls=re.findall(r'href="([^"]+)"',cells[1])
 record=dict(zip(['id','title','host','platform','date','runtime','legacy_verification_claim'],texts))
 record.update(url=html.unescape(urls[0]) if urls else None,review_status='candidate_requires_source_and_identity_review',review_date='2026-10-24')
 if texts[0]=='G5':record.update(possible_catalogue_duplicate_ids=['FKA-048'],review_note='Same host, August 2020 and approximately 92 minutes. Existing claim only distinguishes the December 2020 episode FKA-041. Must reconcile against FKA-048 before counting as additional.')
 if texts[0]=='G8':record.update(related_catalogue_ids=['FKA-050'],review_note='Legacy text references absent G7 and claims the main talk is absent, while FKA-050 records SAND18. Determine whether Q&A is separately published; do not count the main talk again.')
 rows.append(record)
assert len(rows)==10
target=Path('data/gap-candidates.json')
legacy_keys=['id','title','host','platform','date','runtime','legacy_verification_claim','url']
if target.exists():
 existing=json.loads(target.read_text())
 old={r['id']:r for r in existing['records']}
 if '--write' not in sys.argv:
  assert len(old)==len(rows) and all(all(r[k]==old[r['id']][k] for k in legacy_keys) for r in rows),'Gap source drift'
 else:
  for r in rows:
   prior=old.get(r['id'],{})
   r.update({k:v for k,v in prior.items() if k not in legacy_keys})
  existing['records']=rows
  target.write_text(json.dumps(existing,indent=2)+'\n')
else:
 assert '--write' in sys.argv,'Missing gap data; use --write to generate'
 target.write_text(json.dumps({'schema_version':1,'description':'Ten historical gap candidates; not verified unique additions.','records':rows},indent=2)+'\n')
print('PASS: 10 original gap IDs preserved; review evidence retained')
