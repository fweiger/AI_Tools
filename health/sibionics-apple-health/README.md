# 硅基轻享 → Apple 健康

**状态：开发中；未完成真实 iPhone HealthKit 写入验收。**

## 核心流程

每次自由选择任意文件夹中的一份硅基轻享原始 XLSX 或 CSV → Scriptable 解析原始时间和血糖数值 → 配套快捷指令写入 Apple 健康 → 显示本次结果。不绑定固定文件夹或固定文件名。

## 当前开发核心

- [v2.0 源码和详细说明](src/core-v2.0/README.md)
- [v2.0 JS](src/core-v2.0/Sibionics_AppleHealth_OneTap2.0.js)
- [v2.0 快捷指令生成器](src/core-v2.0/build_shortcut.py)

v2.0 尚无可直接安装的已签名快捷指令文件；不得搭配旧版 v1.x。离线模拟测试不等于 iPhone 实际写入。

## 项目文件夹

- `src/core-v2.0/`：当前简化版代码及说明
- `src/legacy/`：历史 Scriptable JS 版本
- `releases/legacy/`：历史快捷指令文件，不作为正式可用版本推荐
- `docs/legacy/`：历史安装说明，仅供追溯
- `docs/audits/`：审计和缺陷
- `build/legacy/`：历史构建文件
- `tests/legacy/`：原始测试和版本清单

## 风险与验收

目前 v2.0 不自动去重，重复选文件可能重复写入，中途失败可能只写入部分记录；时区、单位及原始时间必须在真实设备核对。下一阶段：签名安装文件 → 小批量实机写入 → 核对值与时间 → 测试重复导入与中途失败 → 再考虑稳定版。

原开发分支：`feat/sibionics-apple-health-importer`；[原 PR #5](https://github.com/fweiger/AI_Tools/pull/5)。
