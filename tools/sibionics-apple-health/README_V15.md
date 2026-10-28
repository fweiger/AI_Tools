# SiBionics 硅基轻享 XLSX → Apple 健康：v1.5

## 两个新安装文件（固定提交链接，避免下载旧缓存）

- **[Scriptable v1.5 JS](<https://raw.githubusercontent.com/fweiger/test/cd8fbf67a40cddaabdffead823ed5ed752c1fcc8/tools/sibionics-apple-health/Sibionics_AppleHealth_OneTap1.5.js>)** — 文件名：`Sibionics_AppleHealth_OneTap1.5.js`
- **[苹果快捷指令 v1.5](<https://raw.githubusercontent.com/fweiger/test/cd8fbf67a40cddaabdffead823ed5ed752c1fcc8/tools/sibionics-apple-health/%E7%A1%85%E5%9F%BA%E8%A1%80%E7%B3%96%E5%86%99%E5%85%A5v1.5.shortcut>)** — 文件名：`硅基血糖写入v1.5.shortcut`

不要使用旧的 v1.4 JS，也不要仅改旧文件的显示名称。安装新版 JS 后应出现独立的 **Sibionics_AppleHealth_OneTap1.5** 卡片；快捷指令必须叫 **硅基血糖写入v1.5**。两个版本通过 `SIBIONICS-CGM-V15` 协议配对。

## 实际使用

1. iPhone 从固定链接下载新的 `.js`，移动到「文件 → iCloud 云盘 → Scriptable」，确认出现新的 v1.5 卡片。
2. 从固定链接下载 `.shortcut`，通过「文件」App 打开，并添加到苹果「快捷指令」App。
3. 只打开 **Scriptable v1.5**，直接选择硅基轻享导出的**原始 XLSX**。
4. 如果先出现「发现旧的未开始批次」（之前 v1.4 留下的 3 条），点击 **取消旧版待处理批次并选择 Excel**，会继续打开文件选择器；不需要退出 App 或删除任何台账。
5. 预览会显示真实 Excel 的总条数、未登记条数和本批条数。现在一批最多 200 条，之前的 158 条在没有已登记记录时就是 **本批 158 条**。点击 **确认导入 → 苹果健康** 自动启动 `硅基血糖写入v1.5`。
6. 快捷指令通过 Scriptable PRECHECK 返回的规范化血糖记录写入 Apple 健康，完成之后执行 COMMIT，台账标记本批完成。以后相同时间与数值不再重复提交。

## 数据安全

- 新版本沿用旧的 `sibionics_health_import_v14_state.json`，**不删除历史已登记记录**。这个文件名仅是兼容旧台账，不是 JS 版本；不要删除或更名。
- 对于 `prepared`（尚未开始）的旧批次，用户主动取消后才重新选文件。对于 `running`（可能已部分写入）的旧批次，系统拒绝自动重试，必须先去苹果健康核对已有样本。
- 默认来源时间按 **UTC+08:00** 解析；如果监测器记录的其实是韩国当地 +09:00 时间，写入前需要确认并调整，否则健康记录时间会偏移。
- 一次导入最多 200 条，大于 200 条的 Excel 可多次运行，自动跳过台账已登记记录。
- 代码离线测试 **10/10**（原始 158 条、取消旧 3 条批次后整批导入、保护旧成功记录、PRECHECK 和 COMMIT 数量校验等）。原生快捷指令已签名和完成 SHA-256 校验，但**尚未在用户 iPhone 真实验证 HealthKit 写入**。
- 不要因为提示「导入完成」就假设 Apple 健康已收齐；建议首次导入后检查记录数量、日期与单位。

## 为什么不用旧的下载链接？

GitHub 的 `raw.githubusercontent.com` 分支路径可能短时间返回缓存。以上链接引用**固定 commit cd8fbf67a40cddaabdffead823ed5ed752c1fcc8**，并且 JS 和快捷指令属于同一提交，避免出现一边下载 v1.5、另一边仍是旧代码。

