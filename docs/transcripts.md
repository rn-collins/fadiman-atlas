# Transcript and passage foundation

This is working **offline tooling**, not an ingested Fadiman corpus or a deployed transcript search. No recordings were downloaded, transcribed, or attributed to Jim by this change. Unit-test text is synthetic. Existing catalogue identifiers are preserved.

## What it does

`scripts/transcripts.py` uses Python's standard library to import supplied UTF-8 WebVTT or SRT captions. It retains the source ID, original URL, title, source date and its precision, transcript origin, speaker labels if supplied, millisecond intervals, transcript checksum, and stable passage IDs. Every imported passage is explicitly unreviewed. Unknown speakers remain unknown. Overlapping cues are retained; out-of-order, empty, duplicate, or reversed cues fail validation. A cue with multiple voice labels must first be split.

The `search` and `trace` commands return **literal matching passages**, ordered by source date, with exact text and timestamp locators. `trace` is an alias for the same extractive operation: it does not assert a change in thinking, a contradiction, or agreement. Differing dates can reflect publication dates rather than when a thought was first expressed. Year/month precision is exposed; ordering within an imprecise date cannot be established.

## Import a supplied transcript

Use a transcript the project is entitled to process; record its actual origin, including whether it is automatic captions, a human transcript, or a corrected version. Keep original files unchanged outside the public deployment. Verify the chosen `FKA-###` ID against the catalogue. Format validation does not prove catalogue membership or identity.

Create a metadata JSON file with these fields (the following is a synthetic example, not a real source):

```json
{
  "source_id": "FKA-001",
  "source_url": "https://example.org/synthetic-recording",
  "source_title": "Synthetic demonstration only",
  "source_date": "2020-06",
  "transcript_origin": "Synthetic demonstration captions; not James Fadiman",
  "speaker": null
}
```

`source_date` accepts a known year, year-month, or full date; do not invent an exact date. `speaker` is optional and should only be set for verified single-speaker text. WebVTT voice labels override a supplied default for their individual cues. Neither metadata nor cue labels are speaker verification.

```sh
python3 scripts/transcripts.py import /path/to/supplied.vtt --source /path/to/source.json --output /path/to/new-transcript.json
python3 scripts/transcripts.py validate /path/to/new-transcript.json
python3 scripts/transcripts.py search 'creativity' /path/to/new-transcript.json
python3 scripts/transcripts.py trace 'creativity' /path/to/earlier.json /path/to/later.json
```

Output paths must not already exist, and their parent directories must exist. The command refuses overwrites so corrections become explicit new versions. Passage IDs include source ID, timestamps, speaker and text; a correction changes the affected passage ID. Labels and line-ending changes alone do not change IDs. The provenance checksum records the original UTF-8 input bytes, including any byte-order mark or CRLF endings. Stable IDs identify content, not authenticity.

YouTube URLs use a `t=` locator; other source URLs receive a media fragment such as `#t=12.5`. A timestamp locator does not prove a third-party player supports seeking. Search rejects multiple transcript versions for the same source ID; choose the intended version explicitly.

## Verification and next steps

```sh
python3 -m unittest discover -s tests -p 'transcripts_test.py' -v
```

The importer validates structure and attribution consistency, not whether a quote was really spoken, transcript completeness, rights, or scientific accuracy. It neither accesses the network nor calls paid APIs. Full corpus work still requires actual source files or obtainable captions, source identity checks, correction against the recordings, reviewed speaker attribution, and a publishing decision. Passage content is not automatically placed on the public website. The main catalogue UI continues to search catalogue metadata only. The separate `/passages` page can search transcript JSON files explicitly selected by the researcher.

The schema is in `schema/transcript.schema.json`; the Python validator additionally checks identity hashes, monotonic start times, duplicate passages, and timestamp URL consistency. This importer intentionally accepts only `unreviewed` status. A separate accountable review workflow is required before reviewed passage publication.

## Browser-local passage explorer

Open `/passages` on the Atlas site, select one or more JSON outputs from this importer, and enter a word or exact phrase. Results show original text, source title and date precision, supplied speaker label (or unknown), millisecond-backed time range, passage ID, provenance origin, and original-source timestamp link. The page validates identity hashes with browser Web Crypto. It requires HTTPS or a localhost development server; no external scripts are used.

Files remain in page memory; no upload, storage, telemetry, inference API, or backend is used. Clear the files or reload the page to remove them from the viewer. Clicking a source link deliberately opens that external site. Limits are 50 files, 10 MB combined, and 20,000 passages per file; at most 200 matches display per query. A failed selection imports none of the selected files. Multiple versions of the same source are rejected.

Supplied text is rendered with `textContent`, never interpreted as HTML. Only HTTP(S) citation URLs without credentials are accepted. A matching checksum-shaped field and stable passage hashes do not authenticate the source or original transcript bytes; retain and review the originals. No synthetic examples are included in the viewer.

Run browser-logic tests with `node --test tests/transcripts-viewer.test.cjs`. Tests use synthetic data and include a real Python-to-JavaScript round trip; this does not substitute for visual browser QA.

Optional browser acceptance check (requires Playwright and its Chromium browser):

```sh
node --test tests/transcripts-browser.test.cjs
```

It serves only the viewer and script on localhost, supplies synthetic text, and checks local import/search/clear, unsafe URL rejection, literal rendering, mobile overflow and absence of external requests. The current execution environment had Playwright but no Chromium executable, so this browser test could not run here; the separate seven Node logic tests and ten Python tests passed.
