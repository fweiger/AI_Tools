# 硅基轻享 CGM → Apple 健康

免费的 iPhone 导入辅助工具：直接读取 **硅基轻享导出的 XLSX**（也支持两列 CSV），用 Scriptable 解析，最终由 Apple **快捷指令**通过“记录健康样本”写入苹果健康。

## 现在的状态

- ✅ 解析器已离线测试：真实 XLSX 的日期/数值识别、mmol/L 输出、首次 3 条测试、导入台账和 CSV 输入。
- ⏳ **尚未在 iPhone 实测快捷指令写入 HealthKit**。必须先按下述步骤进行小批量核对。
- ⚠️ 这不是已签名的 `.shortcut` 安装文件，也不是点击 GitHub 就自动获得健康写入权限。首次需要配置快捷指令。

## iPhone 安装（推荐用 JS；避免 UTI 不支持错误）

**如果打开 `.scriptable` 时提示 `Cannot open URL / The UTI of the file is not supported`，说明该分享导入在当前 iPhone 上失败。无需重新安装 Scriptable，也不要重试这个文件。改用以下方法。**

1. 在 iPhone Safari 打开 [JavaScript 源码（GitHub）](https://github.com/fweiger/test/blob/feat/sibionics-apple-health-importer/tools/sibionics-apple-health/Sibionics_AppleHealth_OneTap.js)。
2. 在 GitHub 文件页面使用 `Download raw file` 下载 `.js`；如果显示为文本，Safari 长按 [原始 JS 链接](https://raw.githubusercontent.com/fweiger/test/feat/sibionics-apple-health-importer/tools/sibionics-apple-health/Sibionics_AppleHealth_OneTap.js) 选择「下载链接文件」。
3. 打开 iPhone **「文件」App → 浏览 → 下载项**；长按 `Sibionics_AppleHealth_OneTap.js` → **移动** → **iCloud 云盘 → Scriptable** 文件夹。是 **移动**，不是「分享 → 在 Scriptable 打开」。
4. 返回 Scriptable 首页，等待 iCloud 文件同步，出现脚本卡片 `Sibionics_AppleHealth_OneTap`，即安装成功。**不要直接点卡片写入健康**；HealthKit 写入仍需快捷指令。
5. 如果没有 **iCloud 云盘 → Scriptable** 文件夹，或者脚本不显示：在 Scriptable 首页点右上角 **+** 创建空白脚本，从 GitHub JS 页面复制完整源码粘贴进去，将脚本命名为 `Sibionics_AppleHealth_OneTap`，保存。该方式不依赖 iCloud。

> `.scriptable` JSON 包的结构符合公开格式，但 iOS 文件类型关联可能因下载/分享路径失败。为了兼容性，当前推荐直接安装 `.js` 文件。参考 [Scriptable 官方说明](https://docs.scriptable.app/importmodule/) 和 [社区导入说明](https://github.com/supermamon/scriptable-scripts/blob/master/docs/importing.md)。

## 配置苹果健康写入（只需要一次）

安装 JS 之后按 [SHORTCUT_SETUP.md](./SHORTCUT_SETUP.md) 配置快捷指令。**仅安装 Scriptable 脚本不会把数据写进 Apple 健康。**

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