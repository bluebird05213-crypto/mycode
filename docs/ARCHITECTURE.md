# 项目架构与后续拆分路线

## 当前依赖方向

```text
main.jsx
 ├─ library.jsx ── pdfParser.js ── pdfRuntime.js
 │                    └────────── pdfStore.js
 ├─ libraryRepair.js ── pdfStore.js + pdfParser.js
 ├─ OriginalPage.jsx ── pdfRuntime.js
 ├─ analysis.js
 ├─ StudyAssistant.jsx ── http://127.0.0.1:3001/api/assistant
 └─ server/deepseek-server.mjs ── DeepSeek API
```

## 业务边界

### 1. 导入层

负责文件选择、题库标签、格式判断和导入预览。导入层不直接决定答题页面布局。

### 2. 解析层

`pdfParser.js` 是核心纯逻辑模块：从 PDF 页面恢复文本和坐标，识别题号、选项、答案、解析边界，并生成 `visualParts`、`backupParts` 和题型字段。

### 3. 学习数据层

`pdfStore.js` 负责原文件，`localStorage` 负责学习统计、错题 ID 和连续答对次数。未来可以把这些接口统一成 `src/data/`，让页面不直接依赖存储细节。

### 4. 展示层

`OriginalPage.jsx`、`StudyAssistant.jsx` 和 CSS 负责展示与交互。它们应该接收结构化题目对象，不参与 PDF 拆题。

### 5. 练习编排层

当前练习、随机顺序、错题专项和统计逻辑集中在 `main.jsx`。后续若继续扩展，建议拆成：

- `src/practice/practiceReducer.js`
- `src/practice/questionPool.js`
- `src/practice/WrongNotebook.jsx`
- `src/practice/PracticePage.jsx`

这样可以减少单文件修改冲突，也便于 Codex 只调用需要的模块。

### 6. AI 助手与图片上下文

`StudyAssistant.jsx` 只从当前题卡读取题型、题干、选项、页面反馈和当前题图，并通过本机代理发送。`server/deepseek-server.mjs` 读取 `.env.local` 中的 Key，调用 DeepSeek 的兼容 Chat Completions 接口；Key 不进入前端，也不写入题库数据。存在题图时使用多模态消息内容，最多发送 4 张图片；请求失败或未配置 Key 时，前端回退到 `analysis.js` 的本地提示。题目资料包导出是离线 HTML，不会自动上传。

## 版本兼容原则

- 新增字段时保留旧字段读取能力。
- 修改题库结构时增加 `schemaVersion` 和迁移函数。
- 不把个人题库文件作为代码 fixture 提交。
- 每次解析器修改都用一份脱敏小样本做构建和浏览器回归。
