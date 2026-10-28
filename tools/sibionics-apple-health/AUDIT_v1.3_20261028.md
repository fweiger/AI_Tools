# 硅基轻享 → Apple 健康：v1.3 双端代码审计

**审计日期：2026-10-28。结论：FAIL / NOT_ADMITTED_FOR_HEALTH_IMPORT。不要在苹果健康中批量运行当前 v1.3。**

审计对象：
- `tools/sibionics-apple-health/Sibionics_AppleHealth_OneTap1.3.js`（GitHub 中的 Scriptable 代码，版本 1.3）
- `tools/sibionics-apple-health/硅基血糖写入v1.3.shortcut`（签名原生快捷指令），以及生成前的对应 plist 动作树（26 个动作）
- 本次对话上传的硅基轻享 XLSX（仅本地测试；**真实测量记录与设备标识不上传 GitHub**）

## 1. 完整业务链和实际代码位置

1. **在 Scriptable 点 v1.3 脚本**；`DocumentPicker.openFile()` 选择原始 `.xlsx`（JS `main`，约 267–308 行）。
2. **解析数据**：内置 ZIP/DEFLATE、sheet1 和共享字符串处理，输出 `YYYY-MM-DD HH:mm:ss|血糖值`；校验数值为 0–40，单位默认 mmol/L（171–247 行）。
3. **待处理筛选与预览**：按本地 JSON 台账排除同一时间、同一值的记录，弹窗确认（248–265、309–320 行）。
4. **确认后传递数据**：复制 `SIBIONICS-CGM-V13` + 换行 + 时间/血糖行到剪贴板，再请求 iOS 打开 `shortcuts://run-shortcut?name=硅基血糖写入v1.3&input=clipboard`（321–327 行）。
5. **快捷指令接收**：动作 #0 获取剪贴板；#1、#2 切出首行；#3 检查协议标记；#4、#5、#6 调用 JS 的 `PING-V13` 并核验 `READY|1.3`；#7 再确认。
6. **逐条写入**：动作 #8 去掉协议首行；#9–#16 循环、拆分每行、`detect.date` 解析时间、以 `mmol/L` 通过 `is.workflow.actions.health.quantity.log` 写入苹果健康。
7. **完成后回执**：动作 #17 拼出 `COMMIT\n` + 所有本批文本；#18 调用同一个 JS；JS #275–289 行更新本地 JSON 台账；#19 显示结果。其他动作是条件分支的 Else/End。

**用户应只有一个入口：Scriptable 选择 XLSX；快捷指令作为被自动调用的写入模块。** 不需要 CSV 转换，更不需要手动将整个 XLSX 复制到剪贴板。剪贴板只承载解析后的文本。

## 2. 已通过的静态/离线检查

- JS 语法和本地 Scriptable API 模拟：原始 XLSX 解析出 158 条；初始无台账时输出带协议头的 3 条；取消不调用 Shortcut、不写台账；URL 编码后的 Shortcut 名称相同；`PING-V13` 返回 `READY|1.3`。
- Shortcut plist 共 26 动作；嵌套 IF/ELSE/END 与 Repeat 匹配；动作输出 UUID 引用全部可定位；名称、协议标记、PING 返回值、COMMIT 回调脚本名称一致。
- 正常数据的 `SIBIONICS-CGM-V13\n` 首行正则移除成功；Health 样本类型为 Blood Glucose，声明单位 `mmol/L`；Health log 动作位于循环内、COMMIT 位于循环后。
- `.shortcut` 二进制签名头为 `AEA1`，GitHub Raw 下载得到的 SHA-256 与构建产物一致：`3bc05cde3439ddaecf8244940ca75505d46f957f43f7ac7f27d50d9747791bc8`。
- **这些检查不证明 iPhone HealthKit 的真实授权、时间解析、样本持久化或回执已经成功。**

## 3. 确认的问题（复现过）

| ID | 级别 | 代码/动作 | 问题及复现结果 |
|---|---|---|---|
| P0-01 | 高 | JS 315 行 | 首轮批量上限通过 `fm.fileExists(ledgerPath)` 判断，而不是“是否已经通过 3 条真实 HealthKit 验收”。只要有一个空台账文件，就首次发送 **158 条**，不是 3 条。 |
| P0-02 | 高 | JS 275–289 行 | `COMMIT` 只要包含合法时间/数值即可写入台账；不核对是否为刚刚传给 Shortcut 的批次，不核对已在 HealthKit 持久化。模拟直接调用 `COMMIT\n2026-11-05 12:00:00\|5.5`，成功写入台账，但未执行健康写入。 |
| P0-03 | 高 | Shortcut #15 写入，#17–#18 整批回执 | 第 N 条写入后失败时，前 N−1 条可能已进入 Apple 健康，但整个批次未登记台账。重复执行会造成重复健康样本。现有快捷指令没有读取 HealthKit 样本、逐条确认或部分写入恢复步骤。 |
| P0-04 | 高 | JS 271–274 行；Shortcut #0/#3/#4–#6 | `PING-V13` 永远返回 `READY\|1.3`，没有校验“本批是否待处理、是否已被执行”；旧剪贴板仍含合法标记时，手动重复启动快捷指令可能重复写入。协议标记不等于一次性批次凭证。 |
| P1-05 | 中 | JS 197–200 行 | `readXlsx` 如果某行 B 列完全缺失会**静默丢弃**；用原始文件复制构造“仅 B2 单元格缺失”和“整行缺失”，均未报错，只显示 157 条。B2 数值设为 999 则正确阻止。 |
| P1-06 | 中 | JS 231–246 行 | 相同时间且数值相同的重复行会被 `Map` 合并，且没有重复条数报告；输入覆盖时间是否有不寻常断点也没有检查。 |
| P1-07 | 中 | Shortcut #14 `detect.date`、#15 HealthKit | 时间文本没有显式时区，未验证手机时区、CGM 导出时区是否一致；也没有在写入前断言解析后时间严格等于源数据时间。可能造成错时写入，**属未实机验证风险，不是已复现的错误**。 |
| P1-08 | 中 | JS 单位假设、Shortcut #15 | 当前源表仅“血糖时间/血糖值”表头，没有可供脚本判断 mmol/L 的单位声明；Shortcut 固定为 mmol/L。现有文件数据看似对应，但未来设备或导出格式变更未作准入校验。 |
| P2-09 | 低 | JS 54–157 行 | ZIP 解压代码按 ZIP 声明分配内存，未限定总数据量和压缩比；针对不可信/损坏的 Excel 存在高内存或异常解压风险。 |

## 4. 必须修复的安全门禁（在重新让用户安装之前）

1. **初次验收状态独立于文件是否存在**：空台账不等于已验证；始终先 3 条，真实 HealthKit 读回/人工核对无误后才开放大批量。
2. **一次性批次 ID + 预登记（prepare）**：JS 在确认后保存本批时间和数值清单及 token；快捷指令开始写入前进行比对并标记运行中。旧剪贴板、重复启动、不同版本一律拒绝。
3. **严格回执**：`COMMIT` 必须核对刚刚准备并执行的完整批次，不得任意写台账；处理中的批次不得再次自动提交。
4. **部分写入恢复**：Shortcut 如果中途失败必须冻结本批；不得自动重试。恢复前查询 Apple 健康中该时段、该来源的样本，并仅写入确实缺失的项目。可以研究苹果「查找健康样本」动作，但实现和权限均需要 iPhone 实测。
5. **源文件质量门禁**：只允许受支持的 XLSX 格式；对缺 B 列值、重复时间、缺行/时间跳变、异常单位、日期解析不确定情况给出显式报告；不能静默丢数据。
6. **明确时区**：在正式写入前检查原始文件的时间含义（本地时钟 vs CGM 时区）与手机时区；写入 3 条后从苹果健康读回核验时刻和数值。
7. **真实设备验收**：必须按“预览 3 条 → 跳转 → 授权 → 真实写入 → 查询样本 → 登记台账 → 重复执行拒绝写入”的闭环测通，而不是只检查 `.shortcut` 签名或 JS Mock。

## 5. 当前准入结论

**工程解析：部分通过；文件格式/签名：通过；业务端到端：未验收；健康数据写入安全：FAIL。**

**不要现在让用户继续导入 158 条。** 也不要将“签名已生成”“GitHub 已上传”“模拟输出有三条”称为完整成功。先冻结当前 v1.3 作为待修复版本；完成上述门禁后，再提交配套 JS/Shortcut 的单一成对版本并进行小批量 iPhone 验收。

参考：[Apple Shortcuts URL scheme](https://support.apple.com/guide/shortcuts/apd624386f42/ios)；[Scriptable args.shortcutParameter](https://docs.scriptable.app/args/)；[Apple Find Health Samples](https://support.apple.com/guide/shortcuts/apd3c845e881/ios)；[Apple HK blood glucose unit](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/bloodglucose)。