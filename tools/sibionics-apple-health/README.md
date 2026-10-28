# 硅基轻享 CGM → Apple 健康

免费的 iPhone 导入辅助工具：直接读取 **硅基轻享导出的 XLSX**（也支持两列 CSV），用 Scriptable 解析，最终由 Apple **快捷指令**通过“记录健康样本”写入苹果健康。

## 现在的状态

- ✅ 解析器已离线测试：真实 XLSX 的日期/数值识别、mmol/L 输出、首次 3 条测试、导入台账和 CSV 输入。
- ⏳ **尚未在 iPhone 实测快捷指令写入 HealthKit**。必须先按下述步骤进行小批量核对。
- ⚠️ 这不是已签名的 `.shortcut` 安装文件，也不是点击 GitHub 就自动获得健康写入权限。首次需要配置快捷指令。

## 安装脚本（只需一次）

1. 安装免费 [Scriptable](https://apps.apple.com/app/scriptable/id1405459188)。
2. 在 iPhone Safari 打开 [下载解析脚本（GitHub Raw）](https://raw.githubusercontent.com/fweiger/test/feat/sibionics-apple-health-importer/tools/sibionics-apple-health/Sibionics_AppleHealth_OneTap.js)，将 JS 保存到 **文件 App → iCloud 云盘 → Scriptable** 文件夹（若 Scriptable 使用本地文件，也可在 App 中新建脚本并粘贴源码）。
3. 打开 Scriptable，确认存在脚本 `Sibionics_AppleHealth_OneTap`。
4. 按 [快捷指令首次配置指南](./SHORTCUT_SETUP.md) 建立 Apple 健康写入流程。

## 以后怎么用

硅基轻享导出 **原始 XLSX** → 运行 iPhone 快捷指令「硅基血糖导入」→ 选 XLSX → 核对写入结果。**不必手工转 CSV、不必把血糖换算成 mg/dL**。

## 格式与隐私

- XLSX：第一张工作表 A 列为“血糖时间”，B 列为“血糖值”，数值默认 **mmol/L**；需有这两个中文表头。
- CSV：两列时间和血糖值；可保留表头，支持 `YYYY/MM/DD HH:mm` 或 `YYYY.MM.DD at HH:mm:ss` 时间。
- 仅文件名明确含 `_mgdL_` 的先前转换版 CSV 才会按 mg/dL 换算；不要对未标记的 mg/dL CSV 直接导入。
- 解析脚本本身无网络请求、不上传任何血糖记录；导入台账保存在 Scriptable 本地目录。**不要把自己的 XLSX/CSV、台账或截图推送到公开 GitHub**。

## 重要限制

- 首次只建议写入 3 条并核对**测量时刻与单位**；台账只知自己写过什么，不能直接读取 Apple 健康中其他应用写入的历史记录。
- 如果 Health 写入循环半途失败，本地台账可能尚未提交；再次运行前先核对并清理已写入的部分，防止重复。
- iPhone 处于不同于测量时的时区时，日期文本需要留意时差。
- 免费开源源代码在此，但未附加开源许可证；如需对外分发衍生作品应另行确定授权。

## 文件

- `Sibionics_AppleHealth_OneTap.js`：Scriptable 离线解析器。
- `SHORTCUT_SETUP.md`：首次在苹果快捷指令 App 中搭建 HealthKit 写入动作的步骤。

兼容性参考：[Scriptable 文档](https://docs.scriptable.app/) · [Scriptable 文件导入说明](https://github.com/supermamon/scriptable-scripts/blob/master/docs/importing.md)