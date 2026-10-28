# iPhone 快捷指令首次设置

> 此仓库仅包含离线 XLSX/CSV 解析脚本，尚未提供经过 Apple 签名的 .shortcut。HealthKit 写入部分需要你在 iPhone 完成首次配置并授权。请先测试 3 条记录。

1. 在 iPhone 安装免费 Scriptable，并从 [GitHub Raw JS](https://raw.githubusercontent.com/fweiger/test/feat/sibionics-apple-health-importer/tools/sibionics-apple-health/Sibionics_AppleHealth_OneTap.js) 将脚本导入 Scriptable。
2. 新建名为「硅基血糖导入」的快捷指令。
3. 添加「选择文件」，接着添加「Scriptable → 运行脚本」，选择 `Sibionics_AppleHealth_OneTap` 并把所选文件传入脚本的快捷指令参数。脚本返回 `YYYY-MM-DD HH:mm:ss|血糖值`，逐行以换行分隔。
4. 用「如果」判断：若脚本输出等于 `EMPTY`，显示“没有新记录”并停止。
5. 否则「按换行拆分文本」→「重复每一项」→「按 | 拆分重复项目」→ 获取第一项为测量时间、第二项为 mmol/L 数值。时间需用「从输入获取日期」解析成日期。
6. 在重复循环内部添加「记录健康样本」：**类型=血糖、值=第二项、单位=mmol/L、日期=第一项解析后的日期**。不要用当前时间。
7. 重复循环完整结束之后，拼成文本：第一行 `COMMIT`，其后换行接原脚本输出。再调用同一个 Scriptable 脚本，把这段文本作为参数，以登记已导入记录。最后显示完成通知。
8. 首次仅自动输出 3 条；在 Apple 健康核对日期、时刻、值、单位全部正确后，再选择同一个 XLSX 继续导入剩余记录。

## 注意

- 解析和台账离线进行，无需任何血糖数据上传 GitHub。
- 如果循环中途停止，已经写入的记录可能还没登记台账，重试前先核对避免重复。
- 本地台账不能查询由其它导入工具写入的 Apple 健康记录。
- iPhone 根据本地时区解析测量时间，跨时区时特别注意。
- **解析器已在离线模拟环境通过真实 XLSX 测试，尚未完成 iPhone 实机 HealthKit 写入验证。**
