# 推荐版本：v1.5（全新文件名，避免 1.4 缓存）

**[下载 Scriptable JS v1.5](./Sibionics_AppleHealth_OneTap1.5.js)** · **[下载苹果快捷指令 v1.5](./%E7%A1%85%E5%9F%BA%E8%A1%80%E7%B3%96%E5%86%99%E5%85%A5v1.5.shortcut)**

[首次安装、状态恢复及配对检查](./README_V15.md)

**不要继续下载或运行以前的 1.4、1.4.1、1.4.2 文件**；v1.5 的 JS、快捷指令和 V15 协议必须一起使用。保留历史状态文件，首次只验证三条真实 HealthKit 记录。

---


## 当前推荐（v1.4 配套）

**[下载 Scriptable v1.4 JS](./Sibionics_AppleHealth_OneTap1.4.js)** · **[下载苹果「硅基血糖写入v1.4」快捷指令](./%E7%A1%85%E5%9F%BA%E8%A1%80%E7%B3%96%E5%86%99%E5%85%A5v1.4.shortcut)**

[完整使用说明、测试范围与失败恢复](./README_V14.md)

这两个文件必须一起使用。入口是 Scriptable 1.4，选择硅基轻享原始 XLSX、预览确认后自动调用苹果快捷指令，直接写入 Apple 健康（mmol/L）。**不需要 CSV 转换或手工创建快捷指令动作。**

已完成 **22 项 JS 离线场景、7 项快捷指令模拟测试及签名哈希核验**。**尚未在用户 iPhone 通过真实 HealthKit 写入验收**；首次只导入 3 条并核对时间和单位。

旧版 v1.0–v1.3 均已停用，不要混装或重复导入。

---

# 重要：v1.3 审计未通过，暂停 Apple 健康批量写入

**当前状态：NOT_READY / NOT_ADMITTED_FOR_HEALTH_IMPORT。** 2026-10-28 审计已复现空台账导致首轮 158 条写入、无来源校验的 COMMIT、部分写入失败产生重复记录、缺失 Excel 单元格被静默跳过等问题。

**先不要安装或运行现有 v1.3 对苹果健康进行写入，尤其不要导入全部历史记录。** 代码和签名文件为了审计暂时保留，不等于已经通过手机端健康写入验证。

[查看完整审计、复现结果与修复门禁](./AUDIT_v1.3_20261028.md)

---

# 硅基轻享 → Apple 健康（v1.3）

这是当前唯一推荐的 **Scriptable 主入口**方案。已停用之前需要 CSV、中途剪贴板手动操作或反向从快捷指令选 Excel 的方案。

## 下载（两项配套，文件名必须对应）

1. **Scriptable 1.3（XLSX 解析、预览确认和自动跳转）**：[Sibionics_AppleHealth_OneTap1.3.js](https://raw.githubusercontent.com/fweiger/test/feat/sibionics-apple-health-importer/tools/sibionics-apple-health/Sibionics_AppleHealth_OneTap1.3.js)
2. **苹果快捷指令 1.3（接收数据、写入健康、成功回传）**：[硅基血糖写入v1.3.shortcut](https://raw.githubusercontent.com/fweiger/test/feat/sibionics-apple-health-importer/tools/sibionics-apple-health/%E7%A1%85%E5%9F%BA%E8%A1%80%E7%B3%96%E5%86%99%E5%85%A5v1.3.shortcut)

## 只安装一次

- 用 Safari 下载 JS，将 `Sibionics_AppleHealth_OneTap1.3.js` 放进 iPhone「文件 → iCloud 云盘 → Scriptable」。回到 Scriptable，确认首页出现名为 **Sibionics_AppleHealth_OneTap1.3** 的卡片。之前的 1.2 不会因 GitHub 更新而自动升级。
- 用 Safari 下载 **硅基血糖写入v1.3.shortcut**，在 iPhone「文件」App 里点开添加到苹果「快捷指令」App。名称必须为 **硅基血糖写入v1.3**，不需要手动增加动作。
- 以前的 1.2 卡片和旧快捷指令暂时留着，**不要混用**；只测试名称都带 1.3 的这组配对。

## 今后实际使用只有一个入口

**Scriptable → 点击 1.3 卡片 → 选择硅基轻享原始 XLSX → 点击「确认导入 → 苹果健康」→ 自动打开硅基血糖写入v1.3 → 授权写入 → 完成。**

- Scriptable 自动识别 A 列日期和 B 列血糖，单位 mmol/L。**不转换 CSV，不手动复制 Excel 或血糖值**。
- JS 只把解析好的 `YYYY-MM-DD HH:mm:ss|血糖值` 逐行复制到设备剪贴板，前面附专用协议标记 `SIBIONICS-CGM-V13`；通过苹果支持的 `shortcuts://run-shortcut?name=...&input=clipboard` URL 自动调用快捷指令。
- 快捷指令先核对协议标记，再通过 Scriptable 预检 `PING-V13` 返回 `READY|1.3`。匹配才执行 HealthKit 血糖写入。
- 写入全部完成后，快捷指令调用同一个 Scriptable 1.3 的 `COMMIT` 模式登记本地台账。以后相同的时间和值会被跳过。
- **首次台账为空时只写入 3 条测试数据**；验证 Apple 健康中原始时间、血糖、单位准确后，再点击 1.3 卡片重新选同一个 XLSX，继续未登记的数据。

## 故障判断

- 如果 Scriptable 弹窗只有「确定」「当前仅预览」，说明仍然运行旧版；**正确 v1.3 弹窗标题一定含 `v1.3`，并有「确认导入 → 苹果健康」按钮**。
- 如果点击确认没有自动打开快捷指令，检查 iPhone 的「快捷指令」App 是否真的安装 `硅基血糖写入v1.3`，而不只是下载了 `.shortcut` 文件。
- 如果预检或脚本不存在，快捷指令在 **写入健康之前**停止；检查 Scriptable 卡片是否准确命名 `Sibionics_AppleHealth_OneTap1.3`。
- 如果中途失败，Apple 健康可能有部分已写入但 JS 台账尚未登记。重新运行之前先核对已写入的日期，**避免重复**。
- 若日期出现时区偏移或单位不对，立刻停止完整数据导入。

## 状态和隐私

- 已用真实 XLSX 在离线 JS 模拟环境验证：**158 条识别，首轮 3 条，模拟登记后续 155 条**。确认、取消、剪贴板协议、URL 名称和本地 COMMIT 路径均通过模拟测试。
- 签名快捷指令含 **26 个动作**：协议版本检查、Scriptable 预检、HealthKit 写入、成功回调。其签名文件已上传 GitHub，并通过大小、SHA256 和 AEA1 格式核验。
- **尚未在你的 iPhone 上执行真实 HealthKit 写入验收**，因此首轮仅验证 3 条，不能视为已完成设备端同步。
- GitHub 仓库不包含个人 XLSX 或血糖记录；快捷指令签名仅涉及程序动作定义，不包含任何个人健康数据。设备剪贴板会暂时存放本批次的测量数据。

## 历史版本（不再推荐）

`Sibionics_AppleHealth_OneTap.js`、`硅基血糖写入.shortcut` 和 `硅基轻享XLSX一键导入.shortcut` 为此前开发尝试，保留用于审计，不应与 1.3 混用。
