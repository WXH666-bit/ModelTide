# Validation

## v0.1.5 — theme release packaging

Input: theme changes developed on `de6c0df0a8ea5b939f05aa35d10b0faa027d779d`, now authorized for release as 0.1.5. Dependencies and previously passed theme/locale/accounting/UI/native-render checks below were reused; only the package version and release smoke assertions changed during this packaging step.

- `npm run package`: application compilation and native theme-resource embedding passed. The Node license fetch encountered ECONNRESET; only `node scripts/bundle-runtime.mjs` and `node scripts/package-plugin.mjs` were retried, successfully, without rebuilding the application or reinstalling dependencies.
- `npm run test:updater`: 37 checks passed for 0.1.5 metadata.
- `npm run test:packaged`: passed with empty PATH, bundled Node, saved English/Beijing/light-theme preferences, loaded mascot, and clean shutdown. The rendered document uses the saved light theme.
- `npm run installer` and `npm run test:update-install`: passed using the final 0.1.5 installer and the existing isolated 0.1.4 installation. Theme, other preferences, synthetic usage (120 tokens), process shutdown/restart and installer-cache cleanup were preserved. No personal installation was modified.
- Desktop deliverable: `C:/Users/18246/Desktop/ModelTide-0.1.5-Setup-x64.exe`. Older desktop installers are retained.

## Local themes — unreleased, no package build

Input: working-tree theme changes on top of `de6c0df0a8ea5b939f05aa35d10b0faa027d779d`. Package version remains 0.1.4. Per the user's pause, these changes were not committed, pushed or packaged. Tests transpile only small runtime fixtures under `tests/tmp/themes`; existing dependencies, source assets and Electron are reused. The installed personal application and desktop installer are unchanged.

- `npm run typecheck`: passed. `npm test`: original accounting/locale/release tests plus theme contrast passed (14 tests at that point). After adding the collector-restart case, `node node_modules/tsx/dist/cli.mjs --test tests/theme.test.ts tests/theme-settings.test.ts`: 2/2 passed. The latter checks legacy/default themes, invalid IDs, persisted selection, a full collector restart and fallback from an unknown saved theme.
- `npm run test:themes`: passed. Test-only C# compilation includes the current Widget, Theme, Locale and updater sources; it renders the WPF widget and actual WinForms tray menu for all three themes, verifies exclusive menu selection and translated labels, and samples the widget background after each switch. The first fixture lacked the application's version attribute; adding that attribute fixed the test setup without changing production version handling.
- UI/MCP regression passed against the temporary runtime. All three radio choices apply and persist, both languages work, light theme survives renderer reload, and external collector settings calls (simulating the tray) update the open details window within four seconds. Existing range/filter/empty-state/time-zone/MCP/incremental-update/Escape behavior passed. After adding the external-change assertions, only the affected UI suite was rerun with `MODELTIDE_TEST_RUNTIME=tests/tmp/themes/runtime`; unchanged native/unit evidence was reused.
- Real browser visual inspection: all three themes, settings previews, light/dark tray menus and native widget renders were reviewed. Small labels were raised to at least 11 CSS px, chart ticks enlarged, and the font-dependent gear glyph replaced with an SVG. Text-role contrast is at least 4.5:1 on the catalog's background, control, metrics, selected and footer surfaces.
- `inspect.mjs --app` on the three saved rendered overview snapshots at 390px: 0 FAIL, 1 WARN each. Violet is explicitly allowed because the user requested the existing dragon mascot palette. The warning concerns the proportion of 11–12px metadata; it is retained for the fixed 420×560 desktop panel, whose actual Electron screenshots were separately reviewed. An initial 420px inspector run used its built-in 263px height, so those cropped images were superseded by the supported 390px review; it is not treated as an actual app viewport.
- `lint.mjs --app src/ui`: 0 FAIL, 4 WARN. Retained warnings are the period label above the total, actual model ranks, the existing 1px inset comic outline, and em dashes used for missing data/date ranges; none is decorative filler added by this change.
- Visual critique: the token total remains the first answer; panel edges align; the data and selections share one accent; fixture totals reconcile (12.9M); missing values remain dashes; chart labels do not collide; there is no navigation to fold in this compact app. The existing layout and mascot were retained instead of drawing a new screen direction. Preview data is synthetic test usage, not personal usage.

## v0.1.4 — exit and restart with Codex

Input: changes based on `5b211e03edc5aeffdca457084630c36cd4b5efea`, package version `0.1.4`, built in `E:/projects/ModelTide`. Existing dependencies and isolated test installations were reused. Only mutable synthetic SQLite state is reset between native test runs.

- `npm run typecheck`, `npm test` (13 cases), and `npm run package`: passed.
- `npm run test:native`: passed using an isolated, windowless Codex stub. Covers no widget while Codex is absent, process-based detection, multiple instances, last-instance shutdown, collector and widget exit, detail exit, reopening, quick restart, manual-quit suppression, partial settings writes, restored saved follow preference, disabling the watcher, and coordination with the update event. Synthetic usage remains 120 tokens across a restart. The real Codex app and personal installation were not closed or modified.
- The first native test attempt exposed a test harness mistake: a process terminated by a signal can have `exitCode === null`. The test now checks process liveness. After correction and mutable-index reset, the final suite passed.
- `npm run test:ui`, `npm run test:packaged`, `npm run test:visibility` (8 cases), and `npm run test:updater` (37 cases): passed. The visibility policy remains independent of the follow-Codex lifecycle option.
- After the synthetic Codex instance exited, the remaining watcher measured 35,577,856 bytes working set (~33.9 MiB) and 27,947,008 bytes private memory (~26.7 MiB). This is a point-in-time measurement, not a guaranteed upper limit. Neither the widget nor collector remained alive.
- `npm run installer` and `npm run test:update-install`: passed with the final v0.1.4 installer, reusing the isolated installation. Settings, 120 synthetic tokens, process coordination, automatic restart and installer-cache cleanup all passed. No personal installation or startup registry values were changed.
- The lifecycle test is now part of GitHub Actions and does not require Codex installed on the runner. The installer-update fixture also uses a synthetic Codex process so follow-Codex behavior is exercised in CI.

Existing manual DPI, multiple-monitor and Windows sign-in acceptance limits remain. Synthetic process tests do not claim a live end-to-end shutdown of the user's Codex.

## v0.1.3 — updater, install location and widget visibility

Input: release changes based on `dcc2291`, package version `0.1.3`, built in `E:/projects/ModelTide`. Dependencies and earlier unchanged accounting checks were reused.

- `npm run typecheck`, `npm run package`, `npm run installer`: passed for the final build.
- `npm run test:updater`: 37 checks passed for stable version metadata. The updater checks and installer coordination described in the development entry below remain covered.
- `npm run test:visibility`: 8 native policy cases passed: Codex active, another app active, Codex absent/minimized, and the corresponding desktop-visible modes.
- `npm run test:native`, `npm run test:ui`, and `node node_modules/tsx/dist/cli.mjs --test tests/locale.test.ts`: passed. Legacy settings default to Codex-only; both language controls persist the new flag and restore it on reload. Checkbox assertions wait for the asynchronous settings response. Inspected the final Chinese settings screenshot.
- Inspected the installer directory page with Computer Use and entered `E:/Apps/ModelTide` successfully, then closed the test installer without installing. The unchanged NSIS directory-page input was verified on the development candidate before the stable version build. `InstallDirRegKey` supplies the existing install location; explicit update destinations still use `/D`.
- `npm run test:update-install`: passed against the final stable installer in the reused isolated directory on E:. Process shutdown/restart, original preferences (including desktop visibility), synthetic usage and cached-installer cleanup passed. Source move exposed stale synthetic SQLite state; the test now resets only that mutable index. E: is exFAT, so the test copies the one disposable installer when hard links are unavailable; it reuses the application/dependencies. A temporary executable file lock on exFAT exposed an unhandled cache-deletion exception; bounded cleanup retries now handle both sharing and access errors without crashing a successful update.
- The user uninstalled the personal application during this work. Test applications stayed isolated; the personal application was not reinstalled or started. The desktop installer is the deliverable. Existing manual DPI/multiple-monitor/full Codex transition limits still apply; policy tests do not claim live manipulation of Codex.

## Local 0.1.3-dev.1 — tray updater (not pushed or released)

Input: working-tree updater changes based on `dcc2291`, package version `0.1.3-dev.1`. Existing dependencies and UI/accounting regression evidence were reused; accounting and renderer interaction code are unchanged.

- `npm run typecheck`, `npm run build`: passed. Native executables now carry the package's informational version.
- `npm run test:updater`: 37 checks passed. Covers numeric version comparison, same-version/downgrade suppression, stable promotion from a prerelease, malformed/draft/prerelease metadata, exact repository asset URLs, checksum presence/duplicates, streamed download integrity, truncated/disconnected downloads, cancellation including a stalled stream, partial-file cleanup, rate limiting/retry, NSIS paths with spaces, and update coordination events. Uses synthetic HTTP responses; report in `tests/tmp/updater/report.txt`.
- `node node_modules/tsx/dist/cli.mjs --test tests/locale.test.ts`: 2/2 passed.
- `npm run test:native` and `npm run test:packaged`: passed, including watcher/manual-quit behavior, preserved English/Beijing preferences, bundled Node with an empty PATH, details and clean exit.
- `npm run installer` and `npm run test:update-install`: passed with the real NSIS installer. One isolated runtime in `tests/tmp/update-install/app with spaces` was necessary because the normal unpacked runtime is the user's application. The test reuses that install, hard-links the installer to avoid duplicating the archive, opens details, runs the verified helper, waits for native/watcher/collector/details shutdown, updates in place, and verifies a new collector PID, unchanged preferences, the same synthetic usage total, automatic restart, and removal of the installer cache link. No production settings, logs, startup registry values or installed-app registration were changed by this test. Report in `tests/tmp/update-install/report.json`.
- Inspected the English native tray: current development version and Check for updates are visible. Downloads and installer application use the native process/helper only; Electron is not required to check updates.
- A transient connection reset fetching the build-time Node license was resolved by retrying that packaging stage only. No dependency tree or test environment was recopied for the retry.
- Restored the local production widget and watcher using the existing settings. No commit, push, version tag, or GitHub Release was created for this work. Live installation of an unpublished future GitHub release is not claimed; network download cases are synthetic and the installer/restart test uses the local built installer.

## v0.1.2 — unified, immediate-save time-zone picker

Input: changes on top of `cdc54934a86209c8ab42201610e001bef7fb8181`, recorded in the v0.1.2 commit. Only renderer interaction, shared copy, documentation and UI checks changed; existing dependencies and accounting tests are reused.

- `npm run typecheck`: passed.
- `node node_modules/tsx/dist/cli.mjs --test tests/locale.test.ts`: 2/2 passed.
- `node scripts/build.mjs` and `npm run test:ui`: passed. Selecting Beijing or Kathmandu saves without a second action, updates the active query timezone and closes the picker. Invalid search text leaves the existing timezone unchanged. A custom zone (Europe/Rome) uses the same picker. Saved language and timezone survive renderer reload. Existing range/filter/MCP/incremental-update checks pass.
- Inspected Chinese collapsed settings and English expanded search screenshots at the actual panel size. No horizontal overflow. Temporary screenshots and test reports remain in `tests/tmp/ui/`.

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
