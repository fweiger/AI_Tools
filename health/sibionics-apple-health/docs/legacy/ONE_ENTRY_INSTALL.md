# 硅基轻享 XLSX → Apple 健康（唯一推荐流程）

**当前唯一推荐安装文件：** [硅基轻享XLSX一键导入.shortcut（已签名）](https://raw.githubusercontent.com/fweiger/test/feat/sibionics-apple-health-importer/tools/sibionics-apple-health/%E7%A1%85%E5%9F%BA%E8%BD%BB%E4%BA%ABXLSX%E4%B8%80%E9%94%AE%E5%AF%BC%E5%85%A5.shortcut)

## 首次安装（一次即可）

1. 保留已在 iPhone 安装且解析成功的 Scriptable 脚本，脚本在 Scriptable 首页应命名为 `Sibionics_AppleHealth_OneTap1.2`。**不用再修改 JS、不用选择 Scriptable 卡片运行。**
2. 在 iPhone Safari 打开上面的快捷指令下载链接；下载 `硅基轻享XLSX一键导入.shortcut`。
3. 在 iPhone「文件」App → 下载项找到并打开该 `.shortcut` 文件，按系统提示添加到苹果「快捷指令」。
4. 首次写入苹果健康时，允许这个快捷指令写入「血糖」记录。

## 以后日常仅需一个入口

**打开苹果「快捷指令」→ 点击「硅基轻享XLSX一键导入」→ 选择硅基轻享原始 XLSX → 自动完成。**

完整执行过程由同一快捷指令控制：

- 选择 XLSX → 通过 Scriptable 的「运行脚本」动作将文件直接传给已安装的脚本，**原生文件参数传递，无剪贴板**。
- Scriptable 解析 XLSX，返回新增的 `YYYY-MM-DD HH:mm:ss|血糖值` 文本；不再跳回 Scriptable 等用户点确认。
- 快捷指令以原始测量时间和 **mmol/L** 写入 Apple 健康。写入动作执行完成后，**再调用 Scriptable 登记台账**。
- 本地台账已有记录则跳过；如果没有新增记录，快捷指令显示提示并不写入。
- 首次台账为空时，原 Scriptable 会只返回前 3 条，便于核验。确认 Apple 健康里的时间、单位、数值都正确后，再运行相同的 XLSX，就能导入剩余记录。

## 不再使用的旧版本

以下旧尝试已经被新的单入口快捷指令取代，**不要混用或重复导入**：
- 原生 CSV 导入器 `SiBionics_CSV_AppleHealth.signed.shortcut`：需要单独 CSV。
- 旧快捷指令 `硅基血糖写入.shortcut`：需要从 Scriptable 剪贴板跳转，属于上一版架构。
- Scriptable 内的「调用苹果健康写入」按钮：新的单入口流程**不需要点击这个按钮**。

## 重要提示

- 当前已完成：真实 XLSX 的 Scriptable 解析验证、快捷指令动作结构审查、第三方签名和 GitHub 文件哈希验证。
- **尚未完成**：在用户 iPhone 上实际跑通 Shortcuts → Scriptable → Apple 健康的端到端测试。若 iPhone 提示找不到 Scriptable 脚本或某个动作无法识别，应根据具体错误修复；不能声称已实机成功。
- **先用原始 Excel 做 3 条小批量验证**。如果已经有同时间点记录，避免再次写入重复记录。
- 如写入中途失败，部分血糖可能已经写入 Apple 健康但台账尚未更新。重新运行之前，先核对是否发生部分写入。
- 跨时区时应核对测量时间在苹果健康中有无偏移。
- 签名使用第三方服务，提交内容仅包含快捷指令的动作结构，不包含个人 XLSX、血糖值或其他健康记录。所有血糖转换和写入均在用户 iPhone 本地执行。
- 文件 SHA256：`48dfb0c3c8c0d0835f34842c774d133f11619718a93b379b625df592683d0c0f`。

## 工程结构

`Sibionics_AppleHealth_OneTap.js`：既有 Scriptable 解析器。
`硅基轻享XLSX一键导入.shortcut`：本版本**唯一需要新安装**的快捷指令。
`ONE_ENTRY_INSTALL.md`：本说明。
