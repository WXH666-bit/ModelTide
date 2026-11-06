# ModelTide

![ModelTide logo](src/ui/assets/logo.png)

本机 Codex 用量挂件。Logo 根据用户提供的 Codex 龙娘参考图制作，采用银白、淡紫与深紫配色的托腮龙娘与浪花；数据全部保存在本机。

Logo 原图为 `src/ui/assets/logo-source.png`，轻量显示版本为 `logo.png`，Windows 多尺寸图标为 `modeltide.ico`（16–256 px）。使用内置 image_gen 生成，完整提示词保存在同目录的 `logo-prompt.txt`。运行 `npm run icons` 可重新导出显示图与 ICO；`npm run package` 会将图标嵌入原生挂件和 Electron 详情程序。

## 使用

需要 Windows 10/11 x64 与 .NET Framework 4.8（当前 Windows 10/11 通常已具备）。下载构建产物中的 `ModelTide-<版本>-Setup-x64.exe` 并安装；安装包包含 Node.js 运行时和 Electron，无需另装 Node。安装位置为 `%LOCALAPPDATA%/Programs/ModelTide`，可从开始菜单启动。卸载时保留个人设置和统计索引。

也可使用完整的 `release/win-unpacked` 文件夹并运行其中的 `ModelTide.exe`；不能只复制这个启动文件。这是原生常驻挂件，Electron 详情只在点击后启动，Esc 收起时退出详情进程。首次整理流式读取本机日志，随后每 10 秒只读取新增内容。顶部三条短线可拖动；面板标题也可拖动。更新或卸载前请关闭挂件，并临时关闭“跟随 Codex 启动”以释放侦测器文件。

挂件为 48×84 DIP，默认贴在 Codex 最左侧窄栏的左下空白处，避开底部头像和按钮；采用独立窗口跟随实现视觉贴合，不修改 Codex 客户端。Codex 最小化或切换到其他应用时挂件隐藏。右击挂件或托盘图标可打开基本设置。

托盘包含展开面板、刷新、重置位置、置顶、时区、跟随 Codex 启动、开机直接启动和退出。

“跟随 Codex 启动”开启后，会添加当前用户启动项 ModelTideWatcher，并运行不加载 WPF/Electron 的轻量侦测器；它每 2 秒检查 Codex 窗口出现，随后启动挂件。手动退出挂件后，本次 Codex 会话不会立即重启它；下一次 Codex 打开时再启动。关闭该开关会移除启动项，侦测器在下一轮检查退出。“开机直接启动挂件”是独立选项。两个启动选项默认关闭，不需要管理员权限。

支持今天、近 7 天、近 30 天、本月和自定义日期（单次最多 367 个自然日）；近 N 天包含今天。默认时区 America/Los_Angeles，可在设置中改为 Asia/Shanghai 等 IANA 时区。开机启动默认关闭。

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
