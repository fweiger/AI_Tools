# 硅基轻享 XLSX → Scriptable 1.2 → 苹果健康（原生快捷指令）

这是用户已在 iPhone 安装并验证成功的 **Scriptable v1.2** 的配套写入快捷指令，**不需要 CSV，也不需要修改 Excel**。

## 安装

[直接下载已签名的「硅基血糖写入.shortcut」](https://raw.githubusercontent.com/fweiger/test/feat/sibionics-apple-health-importer/tools/sibionics-apple-health/%E7%A1%85%E5%9F%BA%E8%A1%80%E7%B3%96%E5%86%99%E5%85%A5.shortcut)

iPhone Safari 下载后，在「文件 → 下载项」找到 `硅基血糖写入.shortcut`，点开并选择「添加快捷指令」。快捷指令名称需保持 **硅基血糖写入**，因为原 Scriptable 1.2 内固定会启动这个名称。

**不需要手动添加或编辑任何快捷指令动作。** 本文件带有苹果可识别的签名格式；签名已核验，但实际 iPhone 运行和健康写入需要在手机上首次验证。

## 使用

1. 在 iPhone **Scriptable** App 运行已安装的 `Sibionics_AppleHealth_OneTap1.2`（脚本卡片标题为此字符串）；选择硅基轻享导出的原始 **XLSX**。
2. 解析成功后按「**调用苹果健康写入**」按钮，Scriptable 自动将本次血糖记录交到剪贴板并启动已添加的 `硅基血糖写入` 快捷指令。
3. 快捷指令读取每行 `YYYY-MM-DD HH:mm:ss|数值`，以 **mmol/L** 写入 Apple 健康「血糖」，使用各条原始测量时间。第一次需同意健康写入授权。
4. 快捷指令写完后自动调用 Scriptable 的 `COMMIT` 模式，在其本地台账登记刚成功写入的记录，以便下次跳过这些记录；全部操作完成后显示结果。
5. **第一次只写 3 条**。在 Apple 健康核对时间、数值、单位准确后，再在 Scriptable 中运行同一 XLSX，按原台账逻辑处理其余未导入数据。

## 重要限制

- 快捷指令里的 Scriptable 动作已预设脚本名 `Sibionics_AppleHealth_OneTap1.2`。如果你安装的脚本名不同（包括空格或 .js 结尾），快捷指令会找不到脚本；应先与手机脚本列表确认名称。
- 如果已导入 3 条但快捷指令未显示 Scriptable 登记成功，先在 Apple 健康核对是否已经写入，**不要立即重试造成重复**。
- 此方案依赖 Scriptable 1.2；不直接读取 XLSX 的不是快捷指令，而是原有 Scriptable。
- 快捷指令下载、解析和签名阶段不包含任何真实个人血糖测量值。签名服务只接收到快捷指令动作定义，不接触用户 Excel 或健康记录。
- 如果 Apple 健康中显示测量时间偏移、单位不正确，停止批量导入。
- 此为本地验证过动作结构及有效签名的 Beta 版本，**尚未在你的 iPhone 实际执行 Apple 健康写入验证**。

参考资料：[Scriptable 官方 Shortcuts 输入输出文档](https://docs.scriptable.app/args/) · [原 Blood Glucose Importer](https://github.com/sercanerhan/blood-Glucose-Importer-for-Apple-Health)
