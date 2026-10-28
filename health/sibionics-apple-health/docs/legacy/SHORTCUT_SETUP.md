# 硅基轻享 → 苹果健康：一次设置，之后在 Scriptable 中一键导入

适配 `Sibionics_AppleHealth_OneTap.js` **v1.2**（由 GitHub 获取）。使用你原始的硅基轻享 `.xlsx` 或两列 `.csv`；血糖单位始终为 **mmol/L**。

> 已验证解析：原始 Excel 的 158 条血糖。尚未在用户 iPhone 实测 HealthKit 写入，因此第一次仅处理 3 条，核对无误后再批量导入。

## 一、更新 Scriptable 解析器

1. iPhone Safari 打开 [最新版 JavaScript](https://raw.githubusercontent.com/fweiger/test/feat/sibionics-apple-health-importer/tools/sibionics-apple-health/Sibionics_AppleHealth_OneTap.js)。
2. 从 GitHub 下载 `.js`，在 iPhone 「文件」App 中移到 `iCloud 云盘/Scriptable` 并替换同名脚本。不要通过“共享 → Scriptable”打开 `.scriptable` 安装包。
3. 先不要删除原始 XLSX。

## 二、首次建立一个快捷指令（只做一次）

打开 iPhone **快捷指令** App，点右上角 **+**，新建快捷指令并**严格命名**为 `硅基血糖写入`。必须和脚本内的 `HEALTH_SHORTCUT_NAME` 一致。

按以下顺序添加动作（iOS 的中文名称可能略有差异，可搜索英文动作名作为替代）：

| 顺序 | 快捷指令动作 | 设置 | 
|---|---|---|
| 1 | **获取剪贴板** (Get Clipboard) | 将输出设为变量 `批次文本`（使用“设定变量”动作） |
| 2 | **如果** (If) | 若 `批次文本` **不包含** `\|`，显示“未获取到有效血糖记录”并**停止此快捷指令**；否则继续。防止误运行。|
| 3 | **拆分文本** (Split Text) | 输入 `批次文本`，分隔符 **新行**，输出 `血糖行列表` |
| 4 | **重复每一项** (Repeat with Each) | 重复 `血糖行列表` |
| 4.1 | 拆分文本 (Split Text) | 对 `重复项目`，分隔符选 **自定义** `\|` |
| 4.2 | 获取列表中的项目 (Get Item from List) | **第一项** → `时间文本` |
| 4.3 | 获取列表中的项目 (Get Item from List) | **第二项** → `血糖数值` |
| 4.4 | 从输入中获取日期 (Get Dates from Input) | 输入 `时间文本`，转成 `测量日期`。如果有“类型”可选，设置为日期，避免当成纯文本。|
| 4.5 | **记录健康样本** (Log Health Sample) | **类型=血糖**，数值=`血糖数值`，单位=`mmol/L`，**日期=`测量日期`（不是“当前日期”）** |
| 5 | **结束重复** | 完成以上每条记录的写入 |
| 6 | **文本** (Text) | 第一行写 `COMMIT`，第二行插入变量 `批次文本`，中间一个换行，**不要**打引号或添加其他标题 |
| 7 | Scriptable → **运行脚本** (Run Script) | 脚本选择 `Sibionics_AppleHealth_OneTap`，**参数**传入第 6 步的文本（此处不是文件） |
| 8 | **显示结果** (Show Result) | 显示第 7 步 Scriptable 的输出，形如“已登记 3 条” |

苹果健康第一次会向你请求写入 **血糖** 的权限，请允许。

## 三、以后日常使用

1. 打开 **Scriptable**，点击 `Sibionics_AppleHealth_OneTap`。
2. 在文件选择器中选择硅基轻享刚导出的 **原始 XLSX**。
3. 确认解析成功，点击 **“调用苹果健康写入”**。程序自动把待导入记录暂存于 iPhone 剪贴板，跳转到你刚创建的 **“硅基血糖写入”** 快捷指令。
4. 快捷指令逐条记录健康样本，全部成功后提交已导入台账，并显示导入成功数。

**首次**仅写入 3 条；确认苹果健康里时间和数值分别与 Excel 对应后，再次运行 Scriptable 选同一个 XLSX 会自动跳过已登记的 3 条，写入剩余数据。历史数据批次较多时可能花一些时间。

## 四、隐私与故障恢复

- 没有把任何血糖记录上传 GitHub。GitHub 上只保存程序、说明，不保存用户的 XLSX/CSV。
- Scriptable 运行后会将本批次血糖记录暂存到设备的**系统剪贴板**，供快捷指令读取。建议导入完成后用普通文本覆盖剪贴板，避免其它 App 读取。
- **未实机验证完整 HealthKit 流程**：如果快捷指令写到一半报错，可能部分记录已经进入 Apple 健康，但导入台账尚未更新。重新导入前先核对苹果健康中已经写入的样本，避免重复。
- Scriptable 台账只记录本工具成功登记的内容，无法发现苹果健康中其它工具先前写入的同时间样本；首次导入前需检查是否已有重复数据。
- 日期按 iPhone 本地时区解释 Excel 的原始时间。跨时区使用可能产生偏移，请核对首次 3 条。
- 顶部 CGM 数值若低于 3.9 mmol/L，可用指尖血糖复核；有低血糖症状应及时处理，不应为了导入数据而耽误处理。

参考：[Apple：快捷指令通过 URL 启动](https://support.apple.com/guide/shortcuts/run-a-shortcut-using-a-url-scheme-apd624386f42/ios) · [Scriptable：剪贴板](https://docs.scriptable.app/pasteboard/) · [Apple：快捷指令重复操作](https://support.apple.com/guide/shortcuts/use-repeat-actions-apdc11deb2c1/ios)