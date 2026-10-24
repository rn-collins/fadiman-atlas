"""Synthetic parser tests. No quotation in this file is from James Fadiman."""
import hashlib
import json
import subprocess
import sys
import tempfile
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('transcripts', Path(__file__).resolve().parents[1] / 'scripts/transcripts.py')
t = importlib.util.module_from_spec(spec)
spec.loader.exec_module(t)
SOURCE = {'source_id': 'FKA-001', 'source_url': 'https://example.org/synthetic', 'source_title': 'Synthetic test only', 'source_date': '2020', 'transcript_origin': 'Invented unit-test text', 'speaker': None}
VTT = 'WEBVTT\n\n00:00.000 --> 00:02.500\n<v Test Speaker>Creativity &amp; test fixtures.</v>\n\n00:03.000 --> 00:04.000\nA second synthetic cue.\n'


class Transcripts(unittest.TestCase):
    def test_voice_entities_unknown_speaker_and_citations(self):
        d = t.parse_transcript(VTT, SOURCE)
        p, q = d['passages']
        self.assertEqual(p['speaker'], 'Test Speaker')
        self.assertIsNone(q['speaker'])
        self.assertEqual(p['text'], 'Creativity & test fixtures.')
        self.assertEqual(q['citation_url'], 'https://example.org/synthetic#t=3')
        self.assertTrue(all(x['review_status'] == 'unreviewed' for x in d['passages']))

    def test_ids_stable_across_line_endings_and_cue_labels(self):
        a = t.parse_transcript(VTT, SOURCE)
        b = t.parse_transcript(VTT.replace('00:00.000 -->', 'cue-one\n00:00.000 -->').replace('\n', '\r\n'), SOURCE)
        self.assertEqual([x['passage_id'] for x in a['passages']], [x['passage_id'] for x in b['passages']])

    def test_srt_and_youtube_locator(self):
        source = {**SOURCE, 'source_url': 'https://www.youtube.com/watch?v=abc&t=999'}
        d = t.parse_transcript('1\n01:02:03,400 --> 01:02:04,500\nSynthetic.\n', source)
        self.assertEqual(d['passages'][0]['start_ms'], 3723400)
        self.assertEqual(d['passages'][0]['citation_url'], 'https://www.youtube.com/watch?v=abc&t=3723')

    def test_bad_intervals(self):
        for cue in ['00:02.000 --> 00:01.000', '00:02.000 --> 00:02.000', '00:60.000 --> 01:00.000', '-1:00.000 --> 01:00.000']:
            with self.subTest(cue=cue), self.assertRaises(ValueError):
                t.parse_transcript(cue + '\nSynthetic.', SOURCE)

    def test_overlap_retained_but_out_of_order_rejected(self):
        t.parse_transcript('00:00.000 --> 00:03.000\nOne\n\n00:02.000 --> 00:04.000\nTwo', SOURCE)
        with self.assertRaises(ValueError):
            t.parse_transcript('00:02.000 --> 00:03.000\nOne\n\n00:01.000 --> 00:04.000\nTwo', SOURCE)

    def test_reject_changed_attribution_text_and_citation(self):
        for key, value in [('source_id', 'FKA-002'), ('text', 'Altered'), ('citation_url', 'https://elsewhere.example/'), ('review_status', 'approved')]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                d = t.parse_transcript(VTT, SOURCE)
                d['passages'][0][key] = value
                t.validate_document(d)

    def test_reject_missing_metadata_and_invalid_date(self):
        for source in [{**SOURCE, 'source_date': '2020-02-31'}, {**SOURCE, 'source_url': 'javascript:alert(1)'}, {**SOURCE, 'transcript_origin': ''}]:
            with self.assertRaises(ValueError):
                t.parse_transcript(VTT, source)

    def test_chronological_literal_results_and_version_collision(self):
        a = t.parse_transcript(VTT, SOURCE)
        b = t.parse_transcript(VTT, {**SOURCE, 'source_id': 'FKA-002', 'source_date': '2019-06'})
        result = t.search([a, b], 'CREATIVITY')
        self.assertEqual([x['source_id'] for x in result['results']], ['FKA-002', 'FKA-001'])
        self.assertEqual(result['results'][1]['date_precision'], 'year')
        self.assertEqual(t.search([a], 'invented absent topic')['results'], [])
        with self.assertRaises(ValueError):
            t.search([a, a], 'test')
        with self.assertRaises(ValueError):
            t.search([a], ' ')

    def test_cli_round_trip_checksum_search_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            original = VTT.replace('\n', '\r\n').encode()
            (root / 'input.vtt').write_bytes(original)
            (root / 'source.json').write_text(json.dumps(SOURCE))
            script = str(Path(__file__).resolve().parents[1] / 'scripts/transcripts.py')
            cmd = [sys.executable, script, 'import', str(root / 'input.vtt'), '--source', str(root / 'source.json'), '--output', str(root / 'output.json')]
            first = subprocess.run(cmd, capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stderr)
            before = (root / 'output.json').read_bytes()
            document = json.loads(before)
            self.assertEqual(document['provenance']['transcript_sha256'], hashlib.sha256(original).hexdigest())
            second = subprocess.run(cmd, capture_output=True, text=True)
            self.assertEqual(second.returncode, 2)
            self.assertEqual((root / 'output.json').read_bytes(), before)
            found = subprocess.run([sys.executable, script, 'trace', 'creativity', str(root / 'output.json')], capture_output=True, text=True)
            self.assertEqual(found.returncode, 0, found.stderr)
            self.assertEqual(len(json.loads(found.stdout)['results']), 1)
            (root / 'input.vtt').write_text('00:02.000 --> 00:01.000\nInvalid')
            cmd[-1] = str(root / 'invalid.json')
            bad = subprocess.run(cmd, capture_output=True, text=True)
            self.assertEqual(bad.returncode, 2)
            self.assertFalse((root / 'invalid.json').exists())

    def test_multiple_voices_and_duplicate_cue_rejected(self):
        for text in ['00:00.000 --> 00:01.000\n<v Alice>One</v><v Bob>Two</v>', '00:00.000 --> 00:01.000\nOne\n\n00:00.000 --> 00:01.000\nOne']:
            with self.assertRaises(ValueError):
                t.parse_transcript(text, SOURCE)


if __name__ == '__main__':
    unittest.main()
