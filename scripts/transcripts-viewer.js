/* Offline passage viewer. No network requests, storage, uploads, or inferred answers. */
(function (root) {
  'use strict';
  const MAX_BYTES = 10 * 1024 * 1024;
  const MAX_PASSAGES = 20000;
  function requireThat(ok, message) { if (!ok) throw new Error(message); }
  function nonempty(s) { return typeof s === 'string' && s.trim().length > 0; }
  function safeURL(value) {
    requireThat(typeof value === 'string' && !/[\u0000-\u0020\u007f]/.test(value), 'Invalid URL characters');
    let url; try { url = new URL(value); } catch (_) { throw new Error('Invalid source URL'); }
    requireThat(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, 'Only HTTP(S) source URLs without credentials are accepted');
    return url;
  }
  function dateValue(value) {
    requireThat(typeof value === 'string' && /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value), 'Invalid source date');
    const parts = value.split('-').map(Number), y = parts[0], m = parts[1] || 1, d = parts[2] || 1;
    const days = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    requireThat(y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= days[m - 1] && !(parts.length > 1 && parts[1] === 0) && !(parts.length > 2 && parts[2] === 0), 'Invalid calendar date');
    return value;
  }
  function citationURL(value, milliseconds) {
    const url = safeURL(value);
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) {
      url.searchParams.delete('t'); url.searchParams.delete('start');
      url.searchParams.append('t', String(Math.floor(milliseconds / 1000))); url.hash = '';
      return url.href;
    }
    return value.split('#')[0] + '#t=' + milliseconds / 1000;
  }
  async function identity(sourceID, p) {
    const bytes = new TextEncoder().encode(JSON.stringify([sourceID, p.start_ms, p.end_ms, p.speaker, p.text]));
    const digest = await root.crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
    return sourceID + '-P-' + hex.slice(0, 16);
  }
  async function validate(doc) {
    requireThat(doc && doc.schema_version === 1, 'Unsupported transcript schema');
    const s = doc.source;
    requireThat(s && /^FKA-\d{3}$/.test(s.source_id), 'Missing catalogue source ID');
    for (const field of ['source_title', 'source_date', 'transcript_origin']) requireThat(nonempty(s[field]), 'Missing source ' + field);
    safeURL(s.source_url); dateValue(s.source_date);
    requireThat(s.speaker == null || nonempty(s.speaker), 'Invalid source speaker');
    requireThat(doc.provenance && /^[a-f0-9]{64}$/.test(doc.provenance.transcript_sha256) && doc.provenance.importer_version === 1 && nonempty(doc.provenance.method), 'Incomplete transcript provenance');
    requireThat(nonempty(doc.limitations), 'Missing transcript limitations');
    requireThat(Array.isArray(doc.passages) && doc.passages.length > 0 && doc.passages.length <= MAX_PASSAGES, 'Invalid or oversized passage list');
    let previous = -1; const seen = new Set();
    for (const p of doc.passages) {
      requireThat(p && p.source_id === s.source_id, 'Passage source attribution mismatch');
      requireThat(Number.isSafeInteger(p.start_ms) && Number.isSafeInteger(p.end_ms) && p.start_ms >= 0 && p.end_ms > p.start_ms && p.start_ms >= previous, 'Invalid passage timing');
      previous = p.start_ms;
      requireThat(nonempty(p.text) && p.text.length <= 100000, 'Empty or oversized passage text');
      requireThat(Object.hasOwn(p, 'speaker') && (p.speaker === null || nonempty(p.speaker)), 'Missing or invalid speaker');
      requireThat(p.review_status === 'unreviewed', 'This importer accepts unreviewed passages only');
      const expected = await identity(s.source_id, p);
      requireThat(p.passage_id === expected && !seen.has(expected), 'Changed or duplicate passage identity');
      seen.add(expected);
      const suppliedURL = safeURL(p.citation_url);
      requireThat(suppliedURL.href === safeURL(citationURL(s.source_url, p.start_ms)).href, 'Citation does not match source and timestamp');
    }
    return doc;
  }
  function search(documents, query) {
    requireThat(nonempty(query), 'Enter a word or exact phrase');
    const needle = query.toLocaleLowerCase('en-US');
    const matches = [];
    for (const doc of documents) for (const p of doc.passages) {
      if (p.text.toLocaleLowerCase('en-US').includes(needle)) matches.push({ ...p, source: doc.source });
    }
    return matches.sort((a,b) => a.source.source_date.localeCompare(b.source.source_date) || a.source_id.localeCompare(b.source_id) || a.start_ms - b.start_ms);
  }
  function textElement(document, tag, value) { const el = document.createElement(tag); el.textContent = value; return el; }
  function time(ms) { const sec = Math.floor(ms / 1000); return [Math.floor(sec / 3600), Math.floor(sec / 60) % 60, sec % 60].map(x => String(x).padStart(2, '0')).join(':'); }
  function render(document, container, matches) {
    container.replaceChildren();
    // textContent is deliberate: supplied titles, voices and quotations are untrusted text.
    for (const p of matches.slice(0, 200)) {
      const article = document.createElement('article');
      article.append(textElement(document, 'h3', p.source.source_date + ' · ' + p.source.source_title));
      article.append(textElement(document, 'p', p.source_id + ' · ' + p.passage_id + ' · ' + time(p.start_ms) + '–' + time(p.end_ms) + ' · ' + (p.speaker || 'Speaker not identified')));
      article.append(textElement(document, 'blockquote', p.text));
      article.append(textElement(document, 'p', 'Origin: ' + p.source.transcript_origin + ' · Unreviewed · Date precision: ' + ({4:'year',7:'month',10:'day'})[p.source.source_date.length]));
      const link = textElement(document, 'a', 'Open original source at this timestamp ↗');
      link.href = safeURL(p.citation_url).href; link.target = '_blank'; link.rel = 'noopener noreferrer'; article.append(link);
      container.append(article);
    }
  }
  const api = { validate, search, render, safeURL, citationURL, identity, MAX_BYTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AtlasPassages = api;
  if (!root.document || !root.document.getElementById('transcript-files')) return;
  const doc = root.document, input = doc.getElementById('transcript-files'), status = doc.getElementById('import-status'), form = doc.getElementById('passage-search'), result = doc.getElementById('passage-results'), count = doc.getElementById('result-status');
  let documents = [], generation = 0;
  function reset() { generation++; documents = []; input.value = ''; result.replaceChildren(); count.textContent = ''; status.textContent = 'No transcripts loaded.'; }
  doc.getElementById('clear-files').addEventListener('click', reset);
  input.addEventListener('change', async () => {
    const current = ++generation, files = Array.from(input.files); documents = []; result.replaceChildren(); count.textContent = '';
    status.textContent = 'Validating local files…';
    try {
      requireThat(files.length > 0 && files.length <= 50, 'Select 1–50 transcript JSON files');
      requireThat(files.reduce((sum,f) => sum + f.size, 0) <= MAX_BYTES, 'Selected files exceed the 10 MB total limit');
      const next = [], ids = new Set();
      for (const file of files) {
        const loaded = await validate(JSON.parse(await file.text()));
        requireThat(!ids.has(loaded.source.source_id), 'Multiple versions for ' + loaded.source.source_id + '; select one version per source');
        ids.add(loaded.source.source_id); next.push(loaded);
      }
      if (current !== generation) return;
      documents = next;
      status.textContent = documents.length + ' source(s), ' + documents.reduce((n,d) => n + d.passages.length, 0) + ' unreviewed passages loaded locally. Nothing uploaded.';
    } catch (err) { if (current === generation) { documents = []; status.textContent = 'Could not load files: ' + err.message; } }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      requireThat(documents.length > 0, 'Load validated transcript JSON files first');
      const matches = search(documents, doc.getElementById('passage-query').value);
      render(doc, result, matches);
      count.textContent = matches.length + ' matching passage(s), ordered by source date.' + (matches.length > 200 ? ' Showing the first 200; narrow your phrase to see others.' : '') + ' Matches do not establish a change in thinking.';
    } catch (err) { result.replaceChildren(); count.textContent = err.message; }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
