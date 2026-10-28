# 硅基轻享 CGM → Apple 健康

## 当前唯一推荐方案：原始 XLSX 一键导入

**[安装「硅基轻享XLSX一键导入」苹果快捷指令](https://raw.githubusercontent.com/fweiger/test/feat/sibionics-apple-health-importer/tools/sibionics-apple-health/%E7%A1%85%E5%9F%BA%E8%BD%BB%E4%BA%ABXLSX%E4%B8%80%E9%94%AE%E5%AF%BC%E5%85%A5.shortcut)**

[完整安装和验证说明](./ONE_ENTRY_INSTALL.md)

**现在手机已安装并成功解析原始 Excel 的 Scriptable 1.2，不需要重新安装或改脚本。**

操作：打开苹果「快捷指令」App → 点击「硅基轻享XLSX一键导入」 → 选择原始 XLSX → 自动调用 Scriptable 解析 → 写入苹果健康（mmol/L）→ 写入完成后登记已导入记录。

无 CSV 转换、剪贴板、Safari URL 跳转或双 App 手动接力。首次仅写入 3 条供核对；在 Apple 健康确认日期、单位、数值无误再继续其余记录。

**状态**：已签名且 GitHub 文件 SHA-256 已验证；**尚未在真实 iPhone 上完成 HealthKit 写入验证**。如出现错误，应以实际系统提示排查，不可认为已全部导入。

## 历史版本（已停用，请不要混用）

- `SiBionics_CSV_AppleHealth.signed.shortcut`：需要 CSV 的旧版本。
- `硅基血糖写入.shortcut`：从 Scriptable 通过剪贴板和 URL 跳转的旧版本。
- `Sibionics_AppleHealth_OneTap.scriptable`：在某些 iPhone 上提示 UTI 类型不支持的旧打包格式。

当前方案依赖的解析脚本仍是 [`Sibionics_AppleHealth_OneTap.js`](./Sibionics_AppleHealth_OneTap.js)（v1.2），其历史源码和其他文档为排错保留。

**隐私**：仓库中不含真实血糖记录或用户上传的 Excel。签名过程仅处理快捷指令动作结构。
