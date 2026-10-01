# 回归测试

安装 Node.js 22+ 和 Microsoft Edge，在项目目录运行 `npm install`，再运行 `npm test`。Playwright 启动独立无头 Edge，不使用个人浏览器配置。AI 使用模拟返回，无真实模型调用。

| 脚本 | 覆盖 |
| --- | --- |
| public-defaults.cjs | 空白默认资料、模板、已有资料保护 |
| controls.cjs | 原生与 Phoenix 控件、校验和重试 |
| text-assistant.cjs | 点选、授权、生成与写入分离 |
| area-assistant.cjs | 选区、控件归属、逐项核验 |
| page-audit.cjs | HTML 惰性解析、Hotjob、编辑器 |
| site-pipechina.cjs | 管网映射与边界 |
| site-recruit2.cjs | Element Plus 映射、新增和冲突保护 |
| site-moka.cjs | Moka 映射、选项提交和年月 |
| site-beisen.cjs | 中央结算 Phoenix 脱敏 DOM、双栏隔离、证明人/家庭隔离、重复条目、日期、单选、地区路径与冲突保护 |
| site-hotjob-extended.cjs | Hotjob 扩展模板、隐藏备用输入、动态新增字段、英语筛选、技能与地区两级选择、旧模板路由隔离 |
| three-sites-acceptance.cjs | 加载顺序、schema、路由和报告 |
| datang-education.cjs | 教育准备与 frame 定位 |

可单独运行 `node tests/<脚本名>.cjs`。测试采用合成资料，不提交招聘表单；通过不代表全网站兼容。

## 可选本机快照

- page-audit、site-pipechina、site-recruit2、site-moka 接收一个 HTML/TXT 路径。
- three-sites-acceptance 依次接收管网、Element Plus、Moka 三份快照。
- datang-education 可接收外层页面快照。
- Moka 也支持 MOKA_HTML 环境变量；没有显式输入时不会读取私人附件。

快照仅在惰性模板解析，请放入被忽略的 snapshots/ 或 .private/。报告标签、URL 和错误信息分享前仍需检查。部分测试支持 RA_SCREENSHOT 输出截图，请放到 test-results/。
