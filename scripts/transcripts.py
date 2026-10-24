#!/usr/bin/env python3
"""Offline transcript import and extractive discovery. Python standard library only."""
import argparse
import datetime as dt
import hashlib
import html
import json
import re
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

VERSION = 1
LIMITATION = ('Literal matches in supplied transcripts only. These passages do not establish '
              'accuracy, endorsement, efficacy, or a change in the speaker’s thinking. '
              'Source dates are not dates of events being discussed. Human source review is required.')


def date_value(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}(?:-\d{2}(?:-\d{2})?)?', value):
        raise ValueError('source_date must be YYYY, YYYY-MM, or YYYY-MM-DD')
    parts = [int(p) for p in value.split('-')]
    dt.date(*(parts + [1] * (3 - len(parts))))
    return value


def validate_source(source):
    if not isinstance(source, dict):
        raise ValueError('source must be an object')
    for key in ('source_id', 'source_url', 'source_title', 'source_date', 'transcript_origin'):
        if not isinstance(source.get(key), str) or not source[key].strip():
            raise ValueError(f'Missing source field: {key}')
    if not re.fullmatch(r'FKA-\d{3}', source['source_id']):
        raise ValueError('source_id must preserve an existing FKA-### catalogue identifier')
    if re.search(r'[\x00-\x20\x7f]', source['source_url']):
        raise ValueError('Invalid URL characters')
    url = urlsplit(source['source_url'])
    if url.scheme not in ('https', 'http') or not url.netloc or url.username or url.password:
        raise ValueError('source_url must be an HTTP(S) URL without credentials')
    date_value(source['source_date'])
    if source.get('speaker') is not None and (not isinstance(source['speaker'], str) or not source['speaker'].strip()):
        raise ValueError('speaker must be a nonempty string or null')
    return source


def timestamp(value):
    # WebVTT allows mm:ss.mmm and hh:mm:ss.mmm; SRT uses hh:mm:ss,mmm.
    match = re.fullmatch(r'(?:(\d{2,}):)?(\d{2}):(\d{2})[.,](\d{3})', value)
    if not match:
        raise ValueError(f'Invalid timestamp: {value}')
    hours, minutes, seconds, millis = match.groups()
    if int(minutes) >= 60 or int(seconds) >= 60:
        raise ValueError(f'Invalid timestamp range: {value}')
    return int(hours or 0) * 3600000 + int(minutes) * 60000 + int(seconds) * 1000 + int(millis)


def passage_id(source_id, start, end, speaker, text):
    payload = json.dumps([source_id, start, end, speaker, text], ensure_ascii=False, separators=(',', ':'))
    return source_id + '-P-' + hashlib.sha256(payload.encode()).hexdigest()[:16]


def citation_url(url, start):
    parts = urlsplit(url)
    seconds = start // 1000
    if parts.hostname in ('youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'):
        query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k not in ('t', 'start')]
        query.append(('t', str(seconds)))
        return urlunsplit(parts._replace(query=urlencode(query), fragment=''))
    # Media fragments are a locator; third-party players may not honor them.
    return urlunsplit(parts._replace(fragment=f't={start / 1000:g}'))


def parse_transcript(raw, source):
    validate_source(source)
    normalized = raw.replace('\r\n', '\n').replace('\r', '\n').lstrip('\ufeff')
    blocks = re.split(r'\n\s*\n', normalized.strip())
    passages = []
    previous_start = -1
    seen = set()
    for block in blocks:
        lines = block.strip().splitlines()
        if not lines:
            continue
        if lines[0].startswith(('WEBVTT', 'NOTE', 'STYLE', 'REGION')):
            if any('-->' in line for line in lines):
                raise ValueError('Header or metadata block contains cue timing; separate it with a blank line')
            continue
        timing_index = 0 if '-->' in lines[0] else 1
        if len(lines) <= timing_index or '-->' not in lines[timing_index]:
            raise ValueError('Unrecognized block: expected a VTT/SRT cue')
        timing = re.fullmatch(r'(\S+)\s+-->\s+(\S+)(?:\s+.*)?', lines[timing_index])
        if not timing:
            raise ValueError('Malformed cue timing')
        start, end = [timestamp(v) for v in timing.groups()]
        if end <= start:
            raise ValueError('Cue end must be after start')
        if start < previous_start:
            raise ValueError('Cue starts must be chronological')
        previous_start = start
        cue = '\n'.join(lines[timing_index + 1:])
        voices = re.findall(r'<v(?:\.[^\s>]+)*\s+([^>]+)>', cue)
        if len(set(voices)) > 1:
            raise ValueError('Multiple speakers in one cue: split it before importing')
        speaker = html.unescape(voices[0]).strip() if voices else source.get('speaker')
        plain = html.unescape(re.sub(r'<[^>]*>', '', cue)).strip()
        if not plain:
            raise ValueError('Empty cue text')
        pid = passage_id(source['source_id'], start, end, speaker, plain)
        if pid in seen:
            raise ValueError('Duplicate cue')
        seen.add(pid)
        passages.append({'passage_id': pid, 'source_id': source['source_id'],
                         'start_ms': start, 'end_ms': end, 'speaker': speaker,
                         'text': plain, 'citation_url': citation_url(source['source_url'], start),
                         'review_status': 'unreviewed'})
    if not passages:
        raise ValueError('No transcript cues found')
    result = {'schema_version': VERSION, 'source': source,
              'provenance': {'transcript_sha256': hashlib.sha256(raw.encode()).hexdigest(),
                             'method': 'user-supplied timed text; no transcription or speaker inference',
                             'importer_version': VERSION},
              'limitations': LIMITATION, 'passages': passages}
    validate_document(result)
    return result


def validate_document(doc):
    if not isinstance(doc, dict) or doc.get('schema_version') != VERSION:
        raise ValueError('Unsupported transcript schema')
    source = validate_source(doc.get('source'))
    provenance = doc.get('provenance', {})
    if not isinstance(provenance, dict) or not re.fullmatch(r'[0-9a-f]{64}', str(provenance.get('transcript_sha256', ''))):
        raise ValueError('Missing transcript checksum')
    if provenance.get('importer_version') != VERSION or not isinstance(provenance.get('method'), str) or not provenance['method'].strip():
        raise ValueError('Missing transcript provenance')
    if not isinstance(doc.get('limitations'), str) or not doc['limitations'].strip():
        raise ValueError('Missing transcript limitations')
    if not isinstance(doc.get('passages'), list) or not doc['passages']:
        raise ValueError('No passages')
    previous_start, seen = -1, set()
    for p in doc['passages']:
        if not isinstance(p, dict):
            raise ValueError('Invalid passage')
        start, end = p.get('start_ms'), p.get('end_ms')
        if type(start) is not int or type(end) is not int or start < 0 or end <= start or end > 9007199254740991 or start < previous_start:
            raise ValueError('Invalid passage timing')
        previous_start = start
        if p.get('source_id') != source['source_id']:
            raise ValueError('Passage source attribution mismatch')
        if not isinstance(p.get('text'), str) or not p['text'].strip():
            raise ValueError('Missing passage text')
        if 'speaker' not in p:
            raise ValueError('Missing speaker field')
        if p.get('speaker') is not None and (not isinstance(p['speaker'], str) or not p['speaker'].strip()):
            raise ValueError('Invalid speaker')
        expected = passage_id(source['source_id'], start, end, p.get('speaker'), p['text'])
        if p.get('passage_id') != expected or expected in seen:
            raise ValueError('Changed or duplicate passage identity')
        seen.add(expected)
        if p.get('citation_url') != citation_url(source['source_url'], start):
            raise ValueError('Passage citation does not match its source and time')
        if p.get('review_status') != 'unreviewed':
            raise ValueError('This importer does not establish reviewed/approved status')
    return doc


def search(documents, query):
    if not query.strip():
        raise ValueError('A nonempty literal query is required')
    results = []
    sources = set()
    for doc in documents:
        validate_document(doc)
        src = doc['source']
        if src['source_id'] in sources:
            raise ValueError('Multiple transcript versions for one source: select one explicitly')
        sources.add(src['source_id'])
        for p in doc['passages']:
            if query.casefold() in p['text'].casefold():
                results.append({**p, 'source_date': src['source_date'], 'source_title': src['source_title'],
                                'source_url': src['source_url'],
                                'date_precision': {4: 'year', 7: 'month', 10: 'day'}[len(src['source_date'])]})
    return {'query': query, 'mode': 'literal passage search, chronological order',
            'limitations': LIMITATION, 'results': sorted(results, key=lambda p: (p['source_date'], p['source_id'], p['start_ms']))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    imp = commands.add_parser('import', help='Import supplied VTT/SRT without downloading anything')
    imp.add_argument('input', type=Path)
    imp.add_argument('--source', type=Path, required=True, help='JSON source metadata')
    imp.add_argument('--output', type=Path, required=True)
    val = commands.add_parser('validate')
    val.add_argument('files', type=Path, nargs='+')
    for name in ('search', 'trace'):
        find = commands.add_parser(name, help='Return literal matches ordered by source date; no inferred evolution')
        find.add_argument('query')
        find.add_argument('files', type=Path, nargs='+')
    args = parser.parse_args()
    try:
        if args.command == 'import':
            # Refuse overwrites: preserve source versions and original supplied files.
            doc = parse_transcript(args.input.read_bytes().decode('utf-8'), json.loads(args.source.read_text(encoding='utf-8')))
            with args.output.open('x', encoding='utf-8') as out:
                json.dump(doc, out, ensure_ascii=False, indent=2)
                out.write('\n')
            print(f'Imported {len(doc["passages"])} unreviewed passages: {args.output}')
        else:
            docs = [validate_document(json.loads(p.read_text(encoding='utf-8'))) for p in args.files]
            if args.command == 'validate':
                print(f'Validated {len(docs)} transcript document(s); content accuracy and permission not verified')
            else:
                print(json.dumps(search(docs, args.query), ensure_ascii=False, indent=2))
    except (ValueError, OSError, KeyError, TypeError) as exc:
        parser.exit(2, f'Error: {exc}\n')


if __name__ == '__main__':
    main()
