# ModelTide

[简体中文](#简体中文) · [English](#english)

<a id="简体中文"></a>

## 简体中文

![ModelTide logo](src/ui/assets/logo.png)

本机 Codex 用量挂件。Logo 根据用户提供的 Codex 龙娘参考图制作，采用银白、淡紫与深紫配色的托腮龙娘与浪花；数据全部保存在本机。

Logo 原图为 `src/ui/assets/logo-source.png`，轻量显示版本为 `logo.png`，Windows 多尺寸图标为 `modeltide.ico`（16–256 px）。使用内置 image_gen 生成，完整提示词保存在同目录的 `logo-prompt.txt`。运行 `npm run icons` 可重新导出显示图与 ICO；`npm run package` 会将图标嵌入原生挂件和 Electron 详情程序。

## 使用

需要 Windows 10/11 x64 与 .NET Framework 4.8（当前 Windows 10/11 通常已具备）。下载构建产物中的 `ModelTide-<版本>-Setup-x64.exe` 并安装；安装包包含 Node.js 运行时和 Electron，无需另装 Node。安装向导提供“选择安装位置”，默认路径为 `%LOCALAPPDATA%/Programs/ModelTide`，也可选择其他磁盘中的目录。重装时默认带出已有安装位置，托盘更新继续使用当前目录。可从开始菜单启动。卸载时保留个人设置和统计索引。

源码工作目录、浏览器下载目录和程序安装目录彼此独立。若要将已安装的程序搬到其他磁盘，先退出并卸载旧程序，再在安装向导中选择新路径；用量数据和设置仍保存在 `%APPDATA%/ModelTide`。

也可使用完整的 `release/win-unpacked` 文件夹并运行其中的 `ModelTide.exe`；不能只复制这个启动文件。这是原生常驻挂件，Electron 详情只在点击后启动，Esc 收起时退出详情进程。首次整理流式读取本机日志，随后每 10 秒只读取新增内容。顶部三条短线可拖动；面板标题也可拖动。手动覆盖安装或卸载前请关闭挂件，并临时关闭“跟随 Codex 启动”以释放侦测器文件。

挂件为 48×84 DIP，默认贴在 Codex 最左侧窄栏的左下空白处，避开底部头像和按钮；采用独立窗口跟随实现视觉贴合，不修改 Codex 客户端。右击挂件或托盘图标可打开基本设置。

托盘和详情设置中的“仅在 Codex 中显示”默认开启：Codex 在前台时显示常驻挂件，最小化、关闭或切换到其他应用时隐藏。关闭此选项后，桌面和其他应用上也能显示；Codex 关闭或最小化时保留挂件最后的位置（若开启跟随启动，Codex 完全退出时会关闭挂件）。此开关立即生效并保存，和“跟随 Codex 启动”“窗口置顶”独立；详情面板仍可主动从托盘打开。

托盘包含展开面板、刷新、重置位置、置顶、时区、跟随 Codex 启动、开机直接启动、检查更新和退出。

“跟随 Codex 启动”开启后，会添加当前用户启动项 ModelTideWatcher，并运行不加载 WPF/Electron 的轻量侦测器；它每 2 秒检查 Codex 进程，随后启动挂件。Codex 完全退出后，挂件、详情和统计服务也退出，只保留侦测器；再次打开 Codex 时恢复。最小化或切换应用不会触发退出；多个 Codex 实例需要全部退出。手动退出挂件后，本次 Codex 会话不会立即重启它；下一次 Codex 打开时再启动。关闭该开关会移除启动项，侦测器在下一轮检查退出。“开机直接启动挂件”是独立选项。两个启动选项默认关闭，不需要管理员权限。

托盘的“界面主题”或详情设置可切换 **深色、浅色、龙娘淡紫**。深色贴合 Codex 深色界面；浅色使用白底深色文字；龙娘淡紫保留原有配色，也是旧设置的默认主题。选择后自动保存，同步更新挂件、菜单和详情，不增加后台进程。

支持今天、近 7 天、近 30 天、本月和自定义日期（单次最多 367 个自然日）；近 N 天包含今天。默认时区 America/Los_Angeles，可在设置中改为 Asia/Shanghai 等 IANA 时区。开机启动默认关闭。

**时区与语言：** 详情设置提供地区搜索和 27 个常用时区，包括北京时间（北京/上海，`Asia/Shanghai`）、香港、台北、东京、首尔、新加坡、曼谷、印度、尼泊尔、迪拜、伦敦、巴黎、柏林、莫斯科、纽约、芝加哥、丹佛、洛杉矶、温哥华、圣保罗、檀香山、悉尼、阿德莱德、珀斯、奥克兰、约翰内斯堡和 UTC，也可输入其他有效的 IANA 时区。托盘可以直接选择同一组地区。夏令时和半小时/45 分钟偏移按所选地区处理；当前时区显示在面板底部。

在详情设置或托盘的“界面语言”中选择“简体中文”或“English”，面板、挂件、托盘菜单和用量状态说明会随之切换。时区和语言独立保存，重启后保留；升级时不改变已有时区或启动设置。语言默认简体中文，统计默认仍为洛杉矶时区。

点击“统计时区”展开搜索列表，选中地区后立即保存、生效并收起，无需再点保存。自定义 IANA 时区也在同一个搜索框输入，然后点击匹配项。

### 托盘检查更新

右键挂件或托盘图标，选择“检查更新”。发现 GitHub 正式版后，菜单变为“下载并安装 v…”，点击后显示下载百分比，也可取消。安装包通过 SHA-256 校验后，应用会自动关闭详情窗口、挂件和启动侦测程序，在原目录更新，再重新启动；设置和用量索引保留。下载失败可以重试，不会运行未校验的安装包。

检查更新只在点击时访问本项目的 GitHub Release，不在后台定时联网，不上传用量或聊天内容，也不会自动安装预发布版或降级。应用版本显示在托盘菜单。首次从没有更新功能的旧版本升级，仍需安装一次包含此功能的版本。

## 插件与本地 MCP

插件目录在 `release/modeltide-plugin`，提供标准 plugin.json、mcp.json、skill 和 Codex 兼容清单。应用需要先运行，MCP 仅通过当前用户路径派生的 Windows 命名管道读取聚合结果，不开放 TCP 端口。

也可以直接连接 MCP（将路径改为实际解压位置）：

```powershell
codex mcp add modeltide -- "$env:LOCALAPPDATA\Programs\ModelTide\resources\node.exe" "C:\path\to\modeltide-plugin\server\mcp.cjs"
```

可调用 `get_usage_summary`、`get_usage_breakdown`、`open_usage_widget`。查询参数：`range` 为 today/7d/30d/month/custom；自定义时提供 YYYY-MM-DD 格式的 start/end；可选 timezone、model。结果包含统计、模型明细、时间分桶、覆盖状态和更新时间。直接 MCP 配置也提供在 `release/mcp-config.json`。

也可安装项目提供的本地插件市场（这种方式的默认 MCP 命令使用 PATH 中的 Node.js 24+）：

```powershell
codex plugin marketplace add "C:\path\to\ModelTide"
codex plugin add modeltide@modeltide-local
```

不要同时启用独立 MCP 配置和插件中的 MCP，以免工具重复。插件作为本地包提供，不自动提交到公共插件目录。

## 统计口径

- 数据源为 CODEX_HOME（未设置时 ~/.codex）下的 sessions 与 archived_sessions；只读日志，不读 auth.json，不存储聊天正文。
- 总量 = 输入 + 输出；缓存输入包含在输入中，推理输出包含在输出中。
- 累计计数取差值；重复通知、同一会话归档迁移不重复计入；forked_from_id 标记的历史前缀不计入子会话。
- 首条累计数据缺失前缀、计数重置、未知模型等情况标为部分数据。缺失值显示破折号；图表空缺表示无记录，不能解释为零。
- 统计仅覆盖保存于本机的记录。它不是账单、套餐余额，也无法恢复已删除或其他设备上的历史。索引保留已观察到的用量，即使原日志之后删除。
- 一次用量增量归到日志事件时间及最近的模型上下文；日志未提供更细粒度时间时无法还原增量内部跨日的消费。

## 开发与验证

```powershell
npm ci
npm run build
npm start
npm run typecheck
npm test
npm run test:ui
npm run test:native
npm run package
npm run test:packaged
npm run installer
npm run test:updater
npm run test:update-install
```

常驻部分是原生 WPF 小窗口与一个 Node 统计服务；没有常驻 Electron。详情界面用单个 Electron 窗口，收起后退出整个详情进程组。日志按 256 KiB 分块读取；SQLite 页缓存限制为 4 MiB，Node 老生代堆限制为 64 MiB，聚合在数据库执行。可选的跟随启动侦测器不加载 WPF。实际测量记录见 tests/VALIDATION.md。

开发需要 Windows x64、Node.js 24+ 和 .NET Framework 编译器；生成安装包还需要 NSIS 3（或设置 `MODELTIDE_MAKENSIS`）。本地重新打包前应退出正在运行的 release 程序与侦测器。Node 运行时沿用构建机版本，携带对应许可证。

## GitHub Actions 构建

`.github/workflows/windows-build.yml` 在 push、pull request 或手动触发时运行：安装锁定依赖、类型检查、统计测试、构建 Windows 应用、UI/MCP 回归、生成 NSIS 安装包，并在隔离目录安装验证。安装后的测试将 PATH 清空，确认不依赖系统 Node。

在仓库 **Actions → Build Windows → 成功的运行 → Artifacts → ModelTide-Windows-x64** 下载开发构建。正式版本可直接从 [GitHub Releases](https://github.com/WXH666-bit/ModelTide/releases) 下载安装 EXE，无需先下载 Actions 压缩包。普通用户只需使用安装 EXE；插件用于聊天内查询。

### 按版本标签发布

将要发布的代码推送后，创建并推送版本标签即可：

```powershell
git tag v0.1.0
git push origin v0.1.0
```

以后使用新的版本号，例如 `v0.1.1`。构建期间会从标签同步应用、安装包和插件版本，不需要手动修改包版本；同步只发生在 CI 工作目录。支持 `v0.2.0-beta.1` 等预发布标签，对应 Release 会标记为预发布。

只有推送 `v` 开头的有效版本标签才会发布 Release；普通分支 push、PR 和手动构建仅生成 Actions 产物。发布任务必须等待所有构建和测试成功，并使用仓库自带的 `GITHUB_TOKEN`，无需另配个人令牌。EXE、插件 ZIP、SHA256SUMS.txt 和 README.md 全部上传到草稿后才正式发布，避免下载到不完整的一组文件。上传失败可重跑任务继续处理草稿；已发布版本不会被覆盖，请使用新标签。

用户索引与设置存放在 `%APPDATA%/ModelTide`。开发/隔离测试可设置 MODELTIDE_DATA_DIR 与 MODELTIDE_CODEX_DIR；测试文件全部位于 tests/tmp，不作为交付内容。程序没有网络上传和后台模型调用。

## 交付限制

Windows x64 本地应用，未做代码签名。首次扫描耗时取决于日志大小；扫描期间数据标为整理中。窗口跟随识别官方 Windows Codex 安装路径；非标准客户端仍能通过托盘打开独立面板。

已在当前 Windows 机器检查原生挂件、右键/托盘共用菜单与打包后的详情窗口。100%/200% 缩放、多显示器移动、系统重启后的自启动与 Codex 完整关闭再打开仍需人工验收；原生自动测试需要本机 Codex 正在运行。

## 许可证

项目代码采用 [MIT License](LICENSE)。发行包和插件包均附带许可证；第三方组件遵循各自的许可证。

---

<a id="english"></a>

## English

[Back to 简体中文](#简体中文)

ModelTide is a local Codex token-usage companion for Windows, with a silver-haired chibi dragon mascot, a lightweight native widget, and an on-demand detail panel. Usage data stays on your machine.

### Install and use

Download `ModelTide-<version>-Setup-x64.exe` from [GitHub Releases](https://github.com/WXH666-bit/ModelTide/releases). Windows 10/11 x64 and .NET Framework 4.8 are required. The installer bundles Node.js and Electron, so end users do not need to install Node separately. The **Choose Install Location** page lets you select a directory on another drive; the initial default is `%LOCALAPPDATA%/Programs/ModelTide`. Reinstalling defaults to the registered installation directory, and tray updates continue to use the current directory. A Start menu shortcut is added. Uninstalling preserves personal settings and the usage index.

The source workspace, browser download folder and installed application directory are independent. To relocate an existing installation, quit and uninstall the old application first, then choose the new path in the installer. Usage data and preferences stay in `%APPDATA%/ModelTide`.

You can also run `ModelTide.exe` from the complete `release/win-unpacked` directory. Keep that directory together: the launcher EXE alone is not a portable application. Before manually reinstalling or uninstalling, quit the widget and temporarily disable **Start with Codex** to release the watcher executable.

The 48×84 DIP native widget docks near the bottom of Codex's left rail. This is a separate window that follows Codex, not an injected sidebar component. Drag its top grip to move it; click to open details; press Escape to close the entire Electron detail process.

**Show only in Codex**, available in the tray and panel settings, is on by default. The widget hides when Codex is minimized, closed, or another app becomes active. Turn it off to also show the widget on the desktop and over other apps; it retains its last position while Codex is minimized or closed. Changes apply immediately and persist independently of **Start with Codex** and **Always on top**. Details can still be opened explicitly from the tray.

Right-click the widget or its tray icon to open the usage panel, refresh, reset position, change always-on-top, choose a time zone or language, configure startup, or quit.

**Start with Codex** runs a lightweight watcher and registers the current-user `ModelTideWatcher` sign-in entry. It checks Codex processes every two seconds and launches the widget when Codex starts. When all Codex instances exit, the widget, details and collector exit too, leaving only the watcher. Opening Codex again restarts them. Minimizing Codex or switching apps does not shut them down. Manually quitting the widget does not immediately relaunch it in the same Codex session; the next Codex launch can start it again. Disabling this setting removes the sign-in entry and stops the watcher on its next check. **Start widget at sign-in** is a separate setting. Both startup options are off by default and require no administrator access.

### Themes

Choose **Dark**, **Light** or **Dragon violet** in the tray’s **Theme** submenu or the panel settings. Dark blends with Codex’s dark appearance; Light uses a white surface and dark text; Dragon violet keeps the original mascot palette and remains the default for existing preferences. Selection saves immediately and updates the widget, menus and details. No additional background process is needed.

### Time zones and languages

Choose **Settings → Statistics time zone** or the tray time-zone menu. The panel supports searching 27 common regions: Beijing/Shanghai (`Asia/Shanghai`), Hong Kong, Taipei, Tokyo, Seoul, Singapore, Bangkok, New Delhi, Kathmandu, Dubai, London, Paris, Berlin, Moscow, New York, Chicago, Denver, Los Angeles, Vancouver, São Paulo, Honolulu, Sydney, Adelaide, Perth, Auckland, Johannesburg, and UTC. Other valid IANA time zones can be entered manually.

The selected region controls calendar-day boundaries and daylight saving time, including half-hour and 45-minute offsets. The current zone is visible in the panel footer. Changing it does not modify source logs.

Choose **Language → 简体中文 / English** in the panel or tray. The panel, native widget, tray menus, and usage status messages follow the selected language. Language and time zone persist independently across restarts. Existing time-zone and startup preferences are retained on upgrade. Defaults remain Simplified Chinese and `America/Los_Angeles`.

Click **Statistics time zone** to open the searchable list. Selecting a region saves and applies it immediately, then closes the list. To use a custom IANA time zone, type it in the same search field and select the matching entry. No separate Save button is needed.

### Check for updates from the tray

Right-click the widget or tray icon and choose **Check for updates**. When a newer stable GitHub release is available, choose **Download and install v…**. The menu shows download progress and offers cancellation. After SHA-256 verification, ModelTide closes its details window, widget and startup watcher, updates in the same directory, then restarts. Preferences and the usage index are retained. Failed downloads can be retried; unverified installers are never launched.

Checks contact this project's GitHub Release only when requested. There is no periodic background check, no usage/chat upload, no automatic prerelease installation and no downgrade. The tray menu displays the current application version. Older builds without the updater need a one-time manual upgrade to a build that includes it.

### Usage accounting

- Ranges: today, last 7 days, last 30 days, this month, and custom dates (up to 367 calendar days). Rolling ranges include today.
- Sources: `sessions` and `archived_sessions` under `CODEX_HOME`, or `~/.codex` if unset. Logs are read-only; authentication files are not read and chat bodies are not stored.
- Total tokens = input + output. Cached input is included in input; reasoning output is included in output. Neither is added twice.
- Repeated cumulative notifications and archived copies are deduplicated. Recognized fork prefixes are excluded from child-session consumption. Counter resets, missing prefixes, and unknown attribution are marked as partial data.
- Missing data appears as a dash or a chart gap, not zero. Each usage increment belongs to its recorded event timestamp and current model context; finer timing cannot be reconstructed from aggregate records.
- Statistics cover locally retained records only. They are not a bill, plan balance, or cross-device total. The index retains observed usage even if source logs are later removed.

Initial indexing streams historical logs; later scans read appended content every ten seconds. Today uses local hourly buckets; other ranges use daily buckets. Filters, model totals, and trend totals share the same accounting.

### Local plugin and MCP

The optional `modeltide-plugin.zip` contains standard manifests, a skill, and a bundled MCP server. Start the widget first. MCP communicates with the local service through a Windows named pipe, with no TCP listener.

For an installed application, connect MCP directly using its bundled Node runtime (replace the plugin path):

```powershell
codex mcp add modeltide -- "$env:LOCALAPPDATA\Programs\ModelTide\resources\node.exe" "C:\path\to\modeltide-plugin\server\mcp.cjs"
```

Tools: `get_usage_summary`, `get_usage_breakdown`, and `open_usage_widget`. Query arguments include `range` (`today/7d/30d/month/custom`), optional IANA `timezone` and `model`, and `start/end` in YYYY-MM-DD form for custom ranges. Responses include totals, groups, coverage, and last-update information.

Alternatively, after building the project, register its local marketplace:

```powershell
codex plugin marketplace add "C:\path\to\ModelTide"
codex plugin add modeltide@modeltide-local
```

The marketplace plugin's default MCP command requires Node.js 24+ on PATH. Do not enable both connections simultaneously, or tools will appear twice. The plugin is distributed locally and is not automatically submitted to the public plugin directory.

### Development and validation

Development requires Windows x64, Node.js 24+, and the .NET Framework compiler. NSIS 3 (or `MODELTIDE_MAKENSIS`) is required for the installer.

```powershell
npm ci
npm run build
npm start
npm run typecheck
npm test
npm run test:ui
npm run package
npm run test:packaged
npm run installer
npm run test:updater
npm run test:update-install
```

`npm run test:native` exercises startup, shutdown, multiple instances, rapid restart and update coordination using an isolated synthetic Codex process; it does not close the real Codex app. Quit running release executables before rebuilding them. The bundled Node runtime uses the build machine's version and includes its license.

Resident processes are a native WPF widget and a Node collector. Electron exists only while details are open. Logs are read in 256 KiB chunks, the SQLite page cache is limited to 4 MiB, and the Node old-generation heap is limited to 64 MiB. Validation notes are in `tests/VALIDATION.md`.

Data lives in `%APPDATA%/ModelTide`. For isolated tests, use `MODELTIDE_DATA_DIR` and `MODELTIDE_CODEX_DIR`. Temporary files belong in `tests/tmp/` and are excluded from Git and distributions. There are no network uploads or background model calls.

Logo assets: `src/ui/assets/logo-source.png` is the generated original, `logo.png` is the lightweight display export, and `modeltide.ico` contains 16–256 px Windows icons. The logo was created with image_gen using the supplied character reference; its prompt is in `logo-prompt.txt`. Run `npm run icons` to regenerate size/format exports.

### CI builds and releases

`.github/workflows/windows-build.yml` runs on pushes, pull requests, and manual dispatch. It checks types and accounting, builds the Windows app, tests UI/MCP, generates an installer, and installs it in an isolated directory. Packaged-app tests clear PATH to verify that system Node is not required.

Development builds are downloadable from **Actions → Build Windows → a successful run → Artifacts → ModelTide-Windows-x64**. Versioned releases offer direct EXE downloads plus the plugin ZIP, SHA-256 checksums, and this bilingual README.

After pushing the desired source changes, publish a new version by creating and pushing an unused tag:

```powershell
git tag v0.1.1
git push origin v0.1.1
```

CI synchronizes application, installer, and plugin versions from the tag in its own checkout. Tags such as `v0.2.0-beta.1` produce prereleases. Only valid version-tag pushes publish releases; ordinary branch pushes, PRs, and manual builds produce artifacts only.

Publishing waits for all build and test jobs to pass. All files are uploaded to a draft before publication. Failed uploads can be retried against that draft; published releases are never overwritten. The repository's built-in `GITHUB_TOKEN` is used, with no personal token required.

### Limitations and license

The Windows x64 application is unsigned. Initial indexing time depends on log size and is shown as in progress. Window tracking recognizes the official Windows Codex installation; other clients can still use the standalone detail panel from the tray.

Native widget, shared tray menu, and packaged details have been checked on the development machine. Multiple monitors, 100%/200% scaling, Windows sign-in startup, and full Codex minimize/close/reopen transitions still require manual acceptance testing.

Project code is licensed under the [MIT License](LICENSE), included in application and plugin distributions. Third-party components retain their respective licenses.
