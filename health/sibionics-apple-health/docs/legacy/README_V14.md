## iOS 状态文件冲突修复（v1.4.1，2026-10-28）

**已修复 PRECHECK 提示 `sibionics_health_import_v14_state.json.tmp` 无法移动到 Documents（同名项目存在）的错误。**

仅替换同名 JS：[`Sibionics_AppleHealth_OneTap1.4.js`](./Sibionics_AppleHealth_OneTap1.4.js)。**脚本文件名仍为 1.4，内部补丁版本为 1.4.1；原苹果快捷指令「硅基血糖写入v1.4」无需重装**。

修复：删除会因同名而失败的 `FileManager.move(tmp, statePath)`；改用 Scriptable 官方支持的 `writeString(statePath, data)` 覆盖写入，写前保存原状态到 `.bak`，写后比对校验，确认后才清理遗留的 `.tmp`。若主状态缺失但有 `.bak/.tmp`，会停止并避免误认为首次导入。

**异常后的恢复**：这次截屏显示失败于 PRECHECK，健康写入动作还未开始。替换 JS 并重启 Scriptable 后，若显示「发现尚未开始的批次」，可选择「重新启动同一批次」；若显示「上次导入状态不明」，不要重试，先核对 Apple 健康。

本次基于 Scriptable 官方 FileManager API 和原始 XLSX 进行了 13 项离线回归测试，13/13 通过。**真实 iPhone 写入仍需首次 3 条复核。**

---

# 硅基轻享 → Apple 健康（v1.4，配套安装）

> **当前推荐的唯一配对**：Scriptable v1.4 + 苹果快捷指令 v1.4。v1.0～v1.3 均停用，不要混装或重复写入历史数据。

## 下载（只需要这两个文件）

**① Scriptable 脚本**：[Sibionics_AppleHealth_OneTap1.4.js](https://raw.githubusercontent.com/fweiger/test/feat/sibionics-apple-health-importer/tools/sibionics-apple-health/Sibionics_AppleHealth_OneTap1.4.js)

**② 苹果快捷指令**：[硅基血糖写入v1.4.shortcut](https://raw.githubusercontent.com/fweiger/test/feat/sibionics-apple-health-importer/tools/sibionics-apple-health/%E7%A1%85%E5%9F%BA%E8%A1%80%E7%B3%96%E5%86%99%E5%85%A5v1.4.shortcut)

签名快捷指令 SHA-256：`9c21c19a4d43779423ac2b1c263260c6becf59ffd2dcacc734926d4965986c5b`，文件 23,750 字节。无个人血糖值或 Excel 文件嵌入 GitHub 文件。

## 首次设置（只做一次）

1. 用 iPhone Safari 下载 `Sibionics_AppleHealth_OneTap1.4.js`，在「文件」App 中把它移动到 **iCloud 云盘 → Scriptable** 文件夹，回到 Scriptable 首页确认出现 `Sibionics_AppleHealth_OneTap1.4` 卡片。**此前安装的 1.2/1.3 不会自动更新。**
2. 用 iPhone Safari 下载 `硅基血糖写入v1.4.shortcut`，在「文件」App 找到并打开，按提示添加到苹果「快捷指令」App，保留名称 **硅基血糖写入v1.4**。
3. 不再使用旧的 `硅基血糖写入`、`硅基轻享XLSX一键导入` 或 `硅基血糖写入v1.3` 快捷指令。

## 以后每次导入

只需在 **Scriptable** 中点 `Sibionics_AppleHealth_OneTap1.4` → 选择硅基轻享原始 **XLSX** → 在预览弹窗点「确认导入 → 苹果健康」。系统自动启动快捷指令，调用系统「记录健康样本」写入血糖，单位始终为 **mmol/L**。

具体协议：

- JS 生成一个随机批次令牌，把它写到系统剪贴板，启动 `shortcuts://run-shortcut?name=硅基血糖写入v1.4&input=clipboard`；**不把 Excel 或全部血糖值复制到剪贴板**。
- 快捷指令用 `PRECHECK|令牌` 调用 JS。JS 核对当前待处理批次，并在写入开始前把批次锁定为 `running`，然后将 `YYYY-MM-DDTHH:mm:ss+08:00|数值` 逐行直接返回快捷指令。
- 快捷指令循环写入苹果健康，最后用 `COMMIT|令牌|实际处理行数` 调用 JS。只有批次状态、令牌、行数都一致时，JS 才更新本地完成台账。
- **首次没有成功历史批次时只提交 3 条**（与是否存在空台账文件无关）；第一次写入成功后，再次运行同一个 XLSX 会跳过已登记的 3 条并准备剩余记录。

## 数据和失败保护

- 必须有第一行 `血糖时间`/`血糖值`，每个数据行 A、B 两列完整。缺 Excel 行、空白血糖值、重复时间、时间异常、数值超范围均会停止导入；不再默默跳过。
- 源 Excel 时间本身无时区字段，**本版本约定按中国标准时间 UTC+08:00 解释**。如果导出发生在其它时区，请不要直接写入，需先调整来源时区；在不同时区的 iPhone 上显示的本地时钟可能不同。
- 第一次写入完成后，打开苹果「健康」App → 血糖，核对三条的**时间、血糖值和单位**，再继续剩余记录。
- 如果 iPhone 取消、快捷指令报错、HealthKit 在中途失败，当前批次将可能停留在 `running`。程序会**阻止自动重试**，防止把不确定是否写入的记录重复提交。需要先在苹果健康核对已写入记录后才可以安全恢复。
- 本地记录只记录这个工具完成的批次，**不能自动检测其他 App 已经写入的相同血糖数据**。首次使用前请检查苹果健康有没有同时间段的血糖记录。
- 若检测到旧版本已登记记录而新状态尚未建立，会阻止迁移，避免重复导入；请先核对原先是否已写入。

## 质量状态（如实说明）

- JS 解析：用真实原始 XLSX 进行了独立比对，158 条一致；**22 项离线测试通过**，涵盖首批限制、重复提交、取消、异常行、错误令牌、未完成批次和回执行数错误。
- 苹果快捷指令：基于原始公开 iCloud 血糖快捷指令的 HealthKit 动作重新生成 **15 个动作**；通过 **7 项离线动作模拟**，已签名，GitHub 再下载哈希一致。
- **尚无你的真实 iPhone 完整写入成功回执**；离线测试不能取代 iOS Scriptable/快捷指令/HealthKit 的实机验收，特别要核对日期解释和健康权限。
- 如果快捷指令没有正常写入、或发起后没有返回成功，**不要反复重试**，保留错误界面供定位。

[JS 源码](./Sibionics_AppleHealth_OneTap1.4.js) · [快捷指令构建源码](./build_shortcut_v14.py) · [历史 v1.3 QA](./AUDIT_v1.3_20261028.md)