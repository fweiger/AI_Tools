# v1.5 — 硅基轻享原始 XLSX → Apple 健康

本次为**全新文件名**，不是覆盖 `1.4.js` 或 `1.4.2.js`，用于避免 Safari、iCloud「文件」以及 Scriptable 的旧文件缓存。

- Scriptable JS：[`Sibionics_AppleHealth_OneTap1.5.js`](./Sibionics_AppleHealth_OneTap1.5.js)
- 苹果快捷指令：[`硅基血糖写入v1.5.shortcut`](./%E7%A1%85%E5%9F%BA%E8%A1%80%E7%B3%96%E5%86%99%E5%85%A5v1.5.shortcut)

## 安装和使用

1. 用 iPhone Safari 下载 JS v1.5，将其放到「文件」App → **iCloud 云盘 / Scriptable**。Scriptable 首页应当新增一张脚本卡片 `Sibionics_AppleHealth_OneTap1.5`。不要运行旧 1.4 卡片。
2. 下载 `硅基血糖写入v1.5.shortcut`，从「文件」App 点开，添加到苹果「快捷指令」App。名称必须是 `硅基血糖写入v1.5`。
3. **只点击 Scriptable v1.5 卡片**，选择硅基轻享的原始 XLSX → 预览确认 → 点击「确认导入 → 苹果健康」→ 它将调用 `硅基血糖写入v1.5`，后者执行 HealthKit 写入并回传批次回执。
4. 第一次只处理 3 条，先核对 Apple 健康里的**测量日期、时间、血糖值和 mmol/L**，确认无误后才继续。
5. 旧版留下的 `sibionics_health_import_v14_state.json` 和 `.bak/.tmp` 不要直接删除。v1.5 保留相同状态文件路径，用于承接之前导入状态，避免误认所有数据都是新数据。

## 版本对应

| | 精确名称 |
|---|---|
| JS 文件 | `Sibionics_AppleHealth_OneTap1.5.js` |
| Scriptable 卡片 | `Sibionics_AppleHealth_OneTap1.5` |
| 快捷指令 | `硅基血糖写入v1.5` |
| 内部协议 | `SIBIONICS-CGM-V15` |
| 持久化状态 | `sibionics_health_import_v14_state.json`（沿用，不清空） |

## 状态

源代码及已签名快捷指令在 GitHub 可下载；签名快捷指令的 SHA-256 为 `0fd18cc1cc4869e9bd0b2a410c19afca9d962e7fe2c0995feabe49d9bf743b6c`。**尚未在用户 iPhone 上验证真实 Apple 健康写入**；不应直接用全部 158 条做首次试跑。如果 v1.4 留有「上次导入状态不明」的 running 批次，v1.5 会阻止自动重试，须先核对健康记录。
