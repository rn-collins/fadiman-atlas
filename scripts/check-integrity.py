#!/usr/bin/env python3
"""Verify catalogue/recovery/bibliography references without making network claims."""
import json
from pathlib import Path
from urllib.parse import urlsplit
ROOT = Path(__file__).resolve().parent.parent

def read(name):
    return json.loads((ROOT / name).read_text())

def check():
    records = read('data/catalogue.json')['records']
    ids = {r['id'] for r in records}
    assert len(ids) == len(records) == 132
    evidence = read('data/research/link-recovery-2026-10-24.json')
    reviewed = {r['source_id'] for r in evidence['findings']}
    pending = set(evidence['not_reviewed_source_ids'])
    assert reviewed <= ids and pending <= ids and not reviewed & pending
    assert reviewed | pending == ids
    historical = {r['id']: r for r in records}
    for item in evidence['findings']:
        assert item['original_url'] == historical[item['source_id']]['url']
        assert item['historical_status'] == historical[item['source_id']]['status']
        assert item['playback_verified'] is False, 'Review validation before introducing playback approvals'
        assert item['checked_date'] and item['method'] and item['notes']
        for field in ('candidate_url', 'evidence_url', 'media_candidate_url'):
            if item.get(field):
                u = urlsplit(item[field])
                assert u.scheme in ('https','http') and u.netloc and not u.username
    problem_ids = {r['id'] for r in records if r['status'] == 'dead' or not r['url']}
    assert len(problem_ids) == 63 and problem_ids <= reviewed
    gaps = read('data/gap-candidates.json')['records']
    assert len(gaps) == len({r['id'] for r in gaps}) == 10
    for item in gaps:
        for field in ('possible_catalogue_duplicate_ids', 'related_catalogue_ids'):
            assert set(item.get(field, [])) <= ids
    bibliography = read('data/bibliography.json')['records']
    assert len(bibliography) == len({r['id'] for r in bibliography}) == 6
    assert sum(r['kind'] == 'book' for r in bibliography) == 3
    assert sum(r['kind'] == 'paper' for r in bibliography) == 3
    assert all(r['full_text_ingested'] is False for r in bibliography)
    print(f'PASS: {len(records)} preserved IDs; {len(reviewed)} evidence-reviewed, {len(pending)} not rechecked; all 63 historical problem records covered; ten gap candidates and six bibliography records linked.')

if __name__ == '__main__':
    check()
