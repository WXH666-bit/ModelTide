# Validation

## v0.1.1 — locales, regional time zones, MIT

Input: changes on top of `122ad905d56a46e11fec18af606274481c61c931`, recorded with this validation in the v0.1.1 commit. Existing dependencies and isolated fixtures were reused.

- `npm run typecheck`: passed.
- `npm test`: 13/13 passed, including translation key/placeholder parity, all 27 IANA presets, Beijing boundaries, India/Nepal fractional offsets, hourly reconciliation, and existing DST/accounting/release-version regression tests.
- `npm run test:ui`: passed against the final renderer. Covers Chinese/English switching and persistence, region search, English invalid-zone feedback, no overflow, existing MCP/range/filter/update behavior, and details exiting on Escape. Inspected English panel/settings screenshots in `tests/tmp/ui/`.
- `npm run test:native`: passed. Legacy preferences default to Chinese; English and Beijing settings persist; localized responses, watcher startup/manual quit/disable, and collector cleanup pass.
- `npm run test:packaged`: passed with an empty PATH and saved English/Beijing preferences, bundled Node, translated details, loaded logo, and clean exit.
- Built the native widget and inspected its English Today label, shared tray menu, and 27-zone submenu with Beijing selected using Computer Use. Restored the production widget and watcher with the user's Los Angeles timezone and follow-Codex preference preserved.
- MIT text is included at repository root, in the packaged application resources, in the local plugin, and among Release assets. One README contains both languages.

The existing manual display/startup acceptance limitations below remain; this change does not claim new multi-monitor or Windows reboot coverage.

Baseline before native migration (2026-11-05): Electron 45.2.3, Windows x64, 150% display scale, one 64×88 DIP window. Whole process group: working sets 304052 KiB (~297 MiB), private bytes 142712 KiB (~139 MiB). After opening details: working sets 372224 KiB (~364 MiB), private bytes 171136 KiB (~167 MiB). These are measured process-group totals, including browser, renderer, GPU and utility; summed working sets can include shared pages.

Initial engine suite: 8/8 passed (`npm test`). Initial Electron UI suite: all assertions passed (`npm run test:ui`), including ranges, filters, empty state, timezone settings, MCP handshake/three tools and incremental refresh. The native migration reuses the same engine, dependencies and test fixtures; changed integration and visuals are rechecked below.

## Final validation — 2026-11-05

Logo update, later on 2026-11-05: built-in image_gen generated a transparent chibi dragon mascot from the user's reference. Exported a 256 px PNG and eight ICO sizes (16/20/24/32/48/64/128/256). `npm run typecheck` and `npm run test:ui` passed, including a new assertion that the actual logo loads at 256×256. Inspected the panel screenshot and icons extracted by Windows from both packaged EXEs: all show the new mascot. Packaging initially encountered the running startup watcher's file lock; stopped that owned process, completed packaging, then relaunched the widget and watcher with the user's followCodex=true setting preserved. Statistics code and dependencies did not change; prior engine results remain applicable. The source identifiers below describe the earlier functional validation, before this visual-only update.

- `npm run typecheck`: passed after the native migration and tray settings integration.
- `npm test`: 8/8 passed. Covers cumulative duplicates, model changes, contained cache/reasoning counts, incomplete lines, incremental reads, restart, archive movement, forks, counter resets, unknown data, day/month boundaries, DST 23/25-hour days, empty ranges and excluding chat bodies from the database.
- `npm run test:ui`: passed against the final renderer/collector/MCP code. Covers ranges, model filtering, custom empty states, timezone settings, no horizontal overflow, one detail window, all three MCP tools, appended usage visible within 15 seconds, and the Electron process exiting on Escape. No renderer errors. Latest report: tests/tmp/ui/report.json.
- `node scripts/build-native.mjs` and `node scripts/build-native.mjs release/win-unpacked`: passed for the final native code.
- `node tests/native.mjs`: passed after the final native changes. With Codex already running, the watcher launches the native widget/collector; it survives an incomplete settings write, preserves manual quit without respawning, exits when disabled, and the collector exits with its owner. Tests use isolated synthetic data and do not alter startup registry values. Latest report: tests/tmp/native/report.json.
- Packaged application: launched successfully. Used computer-use to inspect the 48×84 DIP native dragon-girl widget and its shared tray/right-click menu, including both startup settings. Inspected packaged details with real aggregate data and verified no ModelTide-Details processes remained after Escape. Production starts with both startup settings disabled.
- Real logs: production indexing completed for 23 local files, with partial coverage explicitly reported. Three read-only samples with 18, 37 and 58 indexed events independently reconciled input/output sums to the source log's final cumulative counters. No source log was changed or copied into a writable test environment.
- Memory after real-log initial indexing, collapsed: native 72,863,744 bytes working set / 58,945,536 private bytes; collector 76,128,256 working set / 73,613,312 private bytes. Combined ~142.1 MiB working set / ~126.4 MiB private bytes, about 52% less working set than the Electron mini baseline. This is a point-in-time measurement; shared pages may be counted more than once and initial indexing costs more than idle. No Electron detail process was resident.
- Local plugin: `codex plugin marketplace add` and `codex plugin add modeltide@modeltide-local` succeeded; CLI reported installed and enabled, version 0.1.0. No public upload.

Input identifiers (SHA-256; dependencies reused):

- native/Widget.cs: `3768383F0D8FE6B74BE2E100C8243C1C56F09ABCC51811F2861F9BE2F64A5622`
- native/Watcher.cs: `53BF674D0088EF7214A827758C3FB6E42CF19114802CAF1A967D1C747E431B8F`
- release/win-unpacked/resources/collector.cjs: `42450497AFA976447884B7B854327982ED803BC6533712C7612B12643E5ED34D`

Manual acceptance still required: 100%/200% scaling, multiple monitors, dragging across different DPI displays, Codex minimize/close/reopen transitions, and startup after a Windows sign-in. Automated watcher testing verifies detection of the currently running Codex and manual-quit suppression; it does not close the user's Codex or reboot Windows. Default docking was corrected to recompute the bottom position when Codex changes height. The desktop integration remains an independent tracked overlay, not an injected Codex sidebar component.
