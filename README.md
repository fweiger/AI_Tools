# AI_Tools · AI 工具项目库

统一管理多个独立的小工具。每个工具独立维护源码、测试、文档、构建和发布状态。

## 工具索引

| 分类 | 项目 | 用途 | 状态 |
|---|---|---|---|
| [health](health/) | [sibionics-apple-health](health/sibionics-apple-health/) | 硅基轻享 XLSX/CSV → 苹果健康 | 开发中，未完成 iPhone 实机验收 |

## 目录规则

每个工具放在 `分类/项目名/`，自带 README。按需要建立 `src/`（源码）、`tests/`（测试）、`docs/`（文档/审计）、`build/`（构建）、`releases/`（发布/历史安装文件）。不要为了占位建立空目录。

新增工具参考 [项目模板](templates/tool/README.md)。不上传个人健康记录、密钥或私有数据。原测试文件 `123` 暂保留。
