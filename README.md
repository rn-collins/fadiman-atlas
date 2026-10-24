# The Fadiman Knowledge Atlas

A source-linked catalogue and research prototype for James Fadiman's recorded public work. This is an independent project; no affiliation or formal endorsement is represented.

**Live:** https://fadiman-atlas.vercel.app

## What works

- 132 preserved catalogue records spanning 1968–2026, including four undated records. Stable source IDs are `FKA-001` through `FKA-132`.
- Local metadata search, filterable explorer, a complete year timeline and literal annotation flags. No external AI API call.
- A dated source-recovery register that preserves original URLs and historical availability labels alongside new evidence.
- A selected bibliography of three books and three papers, each linked to bibliographic sources. No full books or papers are ingested.
- Offline VTT/SRT import with stable passage IDs, source metadata/checksum, supplied speaker labels, timestamp citations, literal passage search and chronological results.
- `passages.html`: browser-local search of imported transcript JSON files. Selected files are neither uploaded nor persisted. No transcripts are bundled.

## Scope corrections

The listed durations sum to about 107.18 hours, including repeated entries and approximate durations. Seventeen records have unknown or non-duration values. This is not unique recording time or Fadiman speaking time.

The historical catalogue marks 50 records dead and contains 15 records with no URL, with two records in both groups: the union is **63**, not 58. These labels are a historical snapshot, not present-day availability conclusions. A successful page or media-header response is not playback verification.

The ten additional-source candidates are not ten verified unique additions. Identity conflicts and source/date corrections are in `data/gap-candidates.json`. The previous claim of an itemized 20+ paper inventory was not reproducible from the repository.

## Files and source of truth

| File | Purpose |
| --- | --- |
| `index.html` | Static UI and retained original catalogue array |
| `data/catalogue.json` | Reproducible structured extraction of that array |
| `data/research/` | Dated audit and recovery evidence; no destructive replacement of original URLs |
| `data/gap-candidates.json` | Ten historical candidate IDs and current identity review |
| `data/bibliography.json` | Selected bibliographic metadata; distinct from recording IDs |
| `scripts/transcripts.py` | Offline import, validation, search and trace |
| `schema/transcript.schema.json` | Timed transcript format |
| `passages.html`, `scripts/transcripts-viewer.js` | Browser-local validated passage explorer |
| `docs/transcripts.md` | Import/search instructions and limitations |

## Run locally

No build or package installation is required. Serve the repository root to load evidence JSON:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`. Opening `index.html` as a file keeps the embedded catalogue usable, but the browser may block JSON fetches; the page offers evidence-file links. Passage IDs and validation use Web Crypto and require HTTPS or localhost in the browser.

## Checks

From the repository root:

```sh
node scripts/catalogue-audit.cjs --check
python3 scripts/check-integrity.py
node tests/prototype-core.cjs
python3 -m unittest discover -s tests -p '*_test.py' -v
node --test tests/transcripts-viewer.test.cjs
```

These checks run in `.github/workflows/atlas-checks.yml`. Optional browser tests require an installed Playwright browser; passing logic tests is not a claim of visual or mobile QA.

## What remains

No recording downloads, automatic transcription, full-corpus passage ingestion, production semantic search or inference endpoint have been implemented. Local search orders literal matches by source date; it does not infer changes in thought, validate clinical claims or verify voices. Source identity and transcript accuracy still require review. The original decision to keep bulk ingestion pending author involvement is preserved.

## Deployment

The existing Vercel project deploys this static repository. Production tracks `main`; feature branches can be reviewed before integration. No new service credentials, paid transcription jobs or external AI services are required for these tools.

## License

Apache-2.0 for repository code — see `LICENSE`. This is not a license grant for linked recordings, books, articles or third-party transcripts.
