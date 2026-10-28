# 硅基轻享 CSV → Apple 健康（原生快捷指令）

**直接安装，不需要 Scriptable，不需要自己逐个添加动作。**

[获取已签名的快捷指令 .shortcut](./SiBionics_CSV_AppleHealth.signed.shortcut)

[直接下载（GitHub Raw）](https://raw.githubusercontent.com/fweiger/test/feat/sibionics-apple-health-importer/tools/sibionics-apple-health/SiBionics_CSV_AppleHealth.signed.shortcut)

## iPhone 安装

1. 在 Safari 打开以上 Raw 下载地址，下载 `SiBionics_CSV_AppleHealth.signed.shortcut`。
2. 打开 iPhone「文件」App → 下载项，点该 `.shortcut` 文件，按提示在苹果「快捷指令」App 中添加。
3. 打开「快捷指令」App，运行「硅基轻享CSV导入苹果健康」（名称可能显示为文件名）。
4. 选择 **CSV** 文件 → 阅读确认弹窗 → 允许快捷指令将血糖写入 Apple 健康。
5. 首次**只用 3 条测试 CSV**，写入后打开「健康」App 搜索「血糖」，核对日期、时间和血糖单位均正确，再考虑导入大文件。

## 输入 CSV 格式（两列，可带表头）

```csv
血糖时间,血糖值
2026/10/28 11:08,4.4
2026/10/28 11:03,4.4
2026/10/28 10:58,4.4
```

**示例数据仅用于解释格式，不是向公开仓库上传个人血糖记录。**

原生快捷指令支持两列 CSV（时间、血糖 mmol/L），自动删除“血糖时间,血糖值”表头和空行，将日期中的 `/` 转成 `-` 后解析，写入苹果健康「血糖」类型，单位 **mmol/L**。首次运行将要求健康写入权限。

**不支持直接读取 XLSX**：如果硅基轻享仅导出 Excel XLSX，需要先将它转换成 CSV，或继续使用已有的 Scriptable XLSX 解析器。不要把 XLSX 改名为 CSV。

## 注意：首次试用和重复导入

- 当前工具的 **CSV 解析逻辑和快捷指令文件签名已离线验证**，但尚未在真实 iPhone 进行 HealthKit 写入实测；首先只导入 3 条。
- **没有完整的历史记录去重能力**。如果重复运行同一个文件，Apple 健康可能出现重复血糖样本；导入大文件前先确认此前是否已写过。
- 如果弹出“无法添加快捷指令”，确认下载的是本仓库后缀为 `.signed.shortcut` 的文件，而不是源代码、未签名文件或 Scriptable 脚本。
- 文件由第三方 Shortcuty 公共签名服务签名。签名请求只含快捷指令代码和字段映射规则，**不包含用户血糖数据**；导入运行时发生在本机。
- 如果日期被识别为当前时间而不是测量时间，**停止导入**，不要继续导入完整历史；先在「快捷指令」中检查日期转换动作。

## 技术说明

基于 [Blood Glucose Importer for Apple Health](https://github.com/sercanerhan/blood-Glucose-Importer-for-Apple-Health) 项目公开的 [iCloud 快捷指令](https://www.icloud.com/shortcuts/1d1ca07a917d4b138b61a83d6eb2bd82) 进行改造。保留苹果系统自带的「记录健康样本」动作，移除冗余循环，增加 CSV 表头过滤、空行处理、日期规范化与写入前确认。源项目许可证以原仓库 `LICENSE` 为准。

此文件是 **可导入的签名快捷指令**，不等同于 iCloud 分享短链接；后者需要在已安装的 Apple 快捷指令 App 内使用「共享 → 复制 iCloud 链接」发布。
