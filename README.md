# 北森练习室（Beisen Practice Lab）

一个只在本机运行的职业测评题库练习网站。当前支持 PDF/文本题库导入、自动题型识别、题目级图形裁切、答案安全展示、自动解析、分类刷题、顺序/随机模式、分类错题本和本机题目助手。

## 当前版本

`0.2.0-beta`：加入本机 DeepSeek 代理、题目图片上下文和题目资料包导出；未配置 Key 时仍自动回退到本地提示。

## 快速启动

需要 Node.js、pnpm。

```powershell
pnpm install
pnpm dev
```

如需启用 AI 追问，另开一个终端启动本机代理：

```powershell
Copy-Item .env.example .env.local
# 编辑 .env.local，填写 DEEPSEEK_API_KEY；不要把 Key 发到聊天或提交到 Git
pnpm ai:server
```

打开终端输出的本地地址，通常是 `http://127.0.0.1:5173/`。

构建检查：

```powershell
pnpm build
```

## 模块地图

| 模块 | 文件 | 作用 |
| --- | --- | --- |
| 应用入口与页面状态 | `src/main.jsx` | 首页、分类、练习、错题本、题库页及状态流转 |
| 题库导入 | `src/library.jsx` | 选择题库标签、上传文件、预览导入结果 |
| PDF 拆题 | `src/pdfParser.js` | 坐标恢复、题号/选项/答案边界、题型识别、题图安全裁切 |
| PDF 文件存储 | `src/pdfStore.js` | 浏览器本地保存和读取原 PDF |
| 旧数据修复 | `src/libraryRepair.js` | 对旧版本题库重新生成答案安全裁切 |
| PDF 运行时 | `src/pdfRuntime.js` | 按需加载 PDF.js |
| 自动解析 | `src/analysis.js` | 文字、数字、材料、性格题的本地解析和答题技巧兜底 |
| 原图显示 | `src/OriginalPage.jsx` | 题目级裁切图、备用原图、点击放大 |
| 题目助手 | `src/StudyAssistant.jsx` | 本机追问、复制当前题目到 Codex、可调整尺寸 |
| DeepSeek 代理 | `server/deepseek-server.mjs` | 在本机保存 Key，转发当前题目文字和题图，不把 Key 暴露给浏览器 |
| AI 配置模板 | `.env.example` | 说明本机代理需要的环境变量，不含真实密钥 |
| 样式 | `src/*.css` | 页面布局、分类卡片、PDF 图片、助手和反馈样式 |

## 数据与隐私边界

- 题库 PDF 和学习记录保存在浏览器本机 IndexedDB/localStorage。
- 个人 PDF、错题记录和浏览器数据不应提交到 GitHub。
- `src` 中只保留解析逻辑和界面代码；真实题库文件应通过网页上传。
- DeepSeek Key 只应保存在未跟踪的 `.env.local`；浏览器只请求本机 `127.0.0.1:3001`，不会接触 Key。
- AI 每次只接收当前题目的题干、选项、页面解析/反馈和最多 4 张当前题图，不上传整套题库或浏览器学习记录。
- 图形题可以通过“导出题目包”生成包含题干、选项、解析和题图的本地 HTML，便于完整复制到 Codex。
- 未启动代理或未配置 Key 时，助手会显示原因并使用本地规则提示，不影响刷题。

## Git 版本工作流

- `main`：稳定、可使用版本。
- `dev`：Codex 开发和验证分支。
- 一个功能完成并通过 `pnpm build` 后提交一次。
- 稳定版本使用标签，例如 `v0.1.0`、`v0.2.0`。
- 出现问题时，可以切换到上一个标签或从标签创建修复分支。

远程仓库：<https://github.com/bluebird05213-crypto/mycode>

后续 Codex 修改流程：检查当前分支 → 修改 → `pnpm build` → 浏览器回归 → 提交 → 自动推送到 GitHub。具体的初学者操作见 [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md)。

## 已知注意事项

- PDF 版式差异很大，导入后应抽查文字题、材料题和图形题。
- 题库自动解析是本地规则兜底，不应把缺失答案当成确认答案。
- `pnpm build` 中第三方图标库可能产生 module-level directive 提示，不影响构建结果。
