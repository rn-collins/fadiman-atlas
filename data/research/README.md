# Catalogue evidence, 24 October 2026

`../catalogue.json` preserves every original catalogue field and stable FKA ID. The original `status` values are an August 29 historical snapshot, not October availability checks. `scripts/catalogue-audit.cjs --check` verifies that the structured extraction agrees with the embedded catalogue.

## Corrected scope

There are 132 entries spanning 1968–2026, including four undated entries. The parseable durations total 107.1831 hours; 17 entries have unknown or non-duration values. This is a sum of listed recording durations, including repeated catalogue entries, not a unique-media total or Fadiman speaking time.

The historical catalogue has 61 live, 50 dead, eight show-page-only, eight no-url, three blog-only, one mismatched, and one show-page record. Fifteen records have no URL. Because these categories overlap, the union of dead status or null URL is **63**, not 58. Seventy-one records are not marked live. These are inventory classifications, not a claim that 63 recordings are unavailable today.

Seven shared-URL groups remain visible. In particular FKA-052/FKA-089 and FKA-081/FKA-082 have conflicting event or part descriptions; shared links do not justify merging them.

## Recovery evidence

`link-recovery-2026-10-24.json` records 65 reviewed IDs: all **63 historical dead-or-null records**, plus FKA-021 and FKA-121. The remaining 67 catalogue records were not rechecked. Review means reconciliation against source metadata, not recovered playable media or an exhaustive internet search.

Thirty-nine historical dead links have different YouTube IDs in the current official archive. Nine other records have archive-linked alternatives; additional findings distinguish commented-out links, duration conflicts, disputed identity and listings without episode URLs. Four candidate MP3 URLs returned HTTP 200 with audio/mpeg headers: FKA-103, FKA-105, FKA-117 and FKA-132. FKA-117 retains a source-identity conflict because the same archive row embeds a different programme. HTTP availability does not verify playback or identity. FKA-113 has a publisher episode page and FKA-121 has a publisher page linking a 16-page PDF transcript. Neither page availability nor an unsuccessful fetch proves current media availability. No finding is playback-verified; no audio was downloaded or transcribed.

## Additional-source candidates and undocumented scope

`../gap-candidates.json` retains all ten original IDs and legacy metadata, including the missing G7 numbering, with separate dated reconciliation. G5 is a confirmed duplicate of FKA-048 via the same publisher player. G8 is a separate SAND18 Q&A, while the main talk is already FKA-050. Primary sources correct G4's announcement to August 2022 and G10's event to September 2025. G9 may overlap existing entries; several other claims remain unresolved. These are ten reviewed historical candidates, not ten verified unique additions.

`../bibliography.json` now provides a selected inventory of three books and three papers. The initial page's claim of more than twenty mapped papers was not reproducible from an itemized inventory in the initial checkout. The selected bibliography does not substantiate that larger claim; bibliographic metadata, accessed full text and ingested full text remain distinct.

## Reproduce

Run `node scripts/catalogue-audit.cjs --check` and `python scripts/catalogue-gaps.py --check` from the repository root. The structural audit requires no external dependencies or network. Recovery findings include source URLs, check dates, methods and explicit limits.

The gap script is read-only by default. Explicit `--write` regenerates legacy fields while retaining every existing non-legacy review field.
