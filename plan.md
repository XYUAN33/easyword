# EasyWord 外研版小学英语学习应用 — 系统开发计划

**更新时间**：2026-06-15
**目标用户**：小学生（外研版教材）
**使用规模**：班级 / 小范围（约 50–500 人）
**当前阶段**：Phase 2-4 已完成，进入完善 & 部署阶段

---

## 一、已完成功能清单

### 1.1 基础架构 ✅

| 项目 | 实现 | 备注 |
|------|------|------|
| **前端框架** | Next.js 16.2.7 (App Router + Turbopack) | 比原计划版本更新 |
| **样式** | Tailwind CSS 4 | 自定义设计系统（无 shadcn/ui） |
| **数据库** | SQLite（Prisma 7.8.0 + better-sqlite3） | 绝对路径 `file:e:/coding/web/EasyWord/easyword/prisma/dev.db` |
| **ORM** | Prisma 7.8.0 | 生成器输出到 `src/generated/prisma/` |
| **认证** | 自定义 JWT（jose 库） | 非 NextAuth.js，更轻量 |
| **状态管理** | React 内置（useState/useEffect/useMemo） | 未引入 Zustand/Jotai |
| **音频播放** | 原生 Audio API | 非 Howler.js |
| **拖拽交互** | CSS pointer events + 原生拖放 | 非 dnd-kit |
| **部署** | 本地开发环境 | 未部署到云服务器 |

### 1.2 账号体系 ✅

- 手机号 + 验证码登录（`src/app/(auth)/login/page.tsx`）
- 开发模式：固定验证码 `123456`
- JWT session 存储在 httpOnly cookie（7天有效期）
- 首次登录自动创建用户
- 自定义 auth hook（`src/hooks/use-auth.ts`）
- 客户端路由守卫（MainLayout 检查登录态）

### 1.3 背单词模块 ✅

#### 数据管理
- 词库表 `Word`（book/unit/module/word/meaning/phonetic/audioUrl/phrases/sentences）
- 支持课本：`四上`、`四下`、`常用单词`
- 常用词按词性分类（动词/形容词/副词/名词/颜色/数字/感叹词）
- DeepSeek 翻译常用词（`/api/words/sync-common`）
- 课本导入脚本（`scripts/seed-words.ts`）

#### 四种练习模式
| 模式 | 组件 | 说明 |
|------|------|------|
| 字母排序 | `letter-sort.tsx` + `drag-spell.tsx` | 听→拼→拖拽排序→反馈，连续4次错误显示答案 |
| 字母填空 | `letter-fill.tsx` | 隐藏随机字母，点击候选字母填入，固定2个干扰字母 |
| 汉语选单词 | `word-choice.tsx` | zh2en 模式，选项来自全册所有单元 |
| 单词选汉语 | `word-choice.tsx` | en2zh 模式，选项来自全册所有单元 |

#### 学习统计
- 单词级统计（练习次数/正确率/积分/下次复习时间）
- 用户总积分
- 正反馈动画（👍 太棒了！）

### 1.4 遗忘曲线复习 ✅

- 艾宾浩斯间隔：1天 → 2天 → 4天 → 7天 → 15天 → 30天
- 复习状态流转：learning → reviewing → mastered（复习5次以上）
- 首页待复习提醒（`/api/words/review-count`）
- 复习流程：单词预览（听发音）→ 拖拽拼写 → 标记记住/忘记
- 忘记的单词重置进度，1天后重新提醒

### 1.5 阅读练习模块 ✅

- 阅读生成页面（`src/app/(main)/reading/page.tsx`）
- 阅读练习页（`src/app/(main)/reading/session/page.tsx`）
- DeepSeek API 生成短文 + 选择题（`/api/reading/generate`）
- 词汇白名单校验（含词形变化 stem 处理）
- RAG 检索（向量搜索同册课文）
- 6个单元的 mock 兜底数据
- 自动批改 + 逐题解析展示

### 1.6 RAG 向量库 ✅

- **存储**：内存向量存储（`src/lib/vector-store.ts`）
  - 余弦相似度搜索
  - 支持按 book/unit 过滤
  - score threshold 可配置
- **Embedding**：Jina AI（优先）+ TF-IDF 本地兜底（`src/lib/embedding.ts`）
  - 维度：1024 (jina-embeddings-v3)
  - TF-IDF 含词形还原 + 哈希降维
- **课文灌库**：`scripts/ingest-textbook.ts`
- 初始化/状态检查 API：`/api/rag/status`、`/api/rag/ingest`

### 1.7 TTS 语音 ✅

- **阿里云 TTS**（`src/lib/tts.ts`）
  - HMAC-SHA1 签名认证
  - 端点：`/stream/v1/tts`
  - Token 放入 `X-NLS-Token` header
  - 音色：xiaoyun（儿童）
- **浏览器 TTS 兜底**（`src/lib/speech.ts`）
  - `speak()`: MP3 优先 → 浏览器 fallback
  - `spellWord()`: 26个字母音频预加载 + 逐字母播放（700ms 间隔）
  - 短语、例句连播
- **批量音频生成**：`scripts/generate-audio.ts`
- **字母音频**：`scripts/generate-letters.ts`

### 1.8 学习进度页 ✅

- 四大统计卡片（已学单词/已掌握/阅读练习/连续天数）
- 学习进度条（已掌握/复习中/学习中）
- 最近7天学习量柱状图
- 最近阅读记录列表

### 1.9 图片资源 ✅

- SVG 图片生成（`scripts/generate-images.ts`）：彩色背景 + emoji + 单词
- 存储路径：`public/images/words/{book}/{wordId}.svg`
- 页面中 `onError` 隐藏加载失败的图片

---

## 二、当前技术栈明细

| 层级 | 实际使用 | 原计划 | 差异原因 |
|------|---------|--------|---------|
| 前端框架 | Next.js 16 + React 19 | Next.js 15 + React 19 | 使用最新版本 |
| 样式 | Tailwind CSS 4 | Tailwind + shadcn/ui | 自定义组件更灵活 |
| 数据库 | SQLite | PostgreSQL | 开发阶段简化，无需外部服务 |
| ORM | Prisma 7.8.0 | Prisma | 版本更新 |
| 认证 | 自定义 JWT (jose) | NextAuth.js v5 | 手机号登录无需第三方 |
| TTS | 阿里云 NLS + 浏览器 | 阿里云/腾讯云 | 阿里云儿童音色好 |
| LLM | DeepSeek | DeepSeek/通义/智谱 | 性价比最高 |
| Embedding | Jina AI + TF-IDF | 智谱/通义 | Jina 免费额度大，TF-IDF 免 API |
| 向量库 | 内存 TF-IDF | Qdrant | Docker 拉取 Qdrant 失败 |
| 拖拽 | 原生 pointer events | dnd-kit | 减少依赖 |
| 状态管理 | React hooks | Zustand/Jotai | 应用规模不需要额外库 |
| 音频 | 原生 Audio API | Howler.js | 减少依赖 |

---

## 三、数据库表结构（实际）

```
User (id, phone, nickname, grade, avatarUrl, createdAt, updatedAt)
  ↓
Session (id, userId, token, expiresAt, createdAt)

Word (id, book, unit, module, word, meaning, phonetic, audioUrl, phrases TEXT, sentences TEXT)
  ↓
UserWordProgress (id, userId, wordId, firstLearned, reviewCount, nextReview, status, errorCount, updatedAt)

ReadingHistory (id, userId, book, unit, passage, questions TEXT, userAnswers TEXT, score, createdAt)

TextbookContent (id, book, unit, module, title, content, words TEXT)
```

---

## 四、项目文件结构

```
easyword/
├── prisma/
│   ├── schema.prisma          # 数据模型定义
│   └── dev.db                 # SQLite 数据库文件
├── config/
│   └── common-words.json      # 常用词分类配置
├── scripts/
│   ├── seed-words.ts          # 单词导入
│   ├── generate-audio.ts      # 批量 TTS 音频生成
│   ├── generate-images.ts     # SVG 配图生成
│   ├── generate-letters.ts    # 字母音频生成
│   ├── ingest-textbook.ts     # RAG 课文灌库
│   ├── test-tts.ts            # TTS 测试
│   ├── tts-endpoints.ts       # TTS 端点探测
│   └── tts-paths.ts           # TTS 路径探测
├── public/
│   ├── audio/words/           # 预生成单词 MP3 (>100个)
│   ├── audio/letters/         # 字母音频
│   └── images/words/          # SVG 配图
├── src/
│   ├── app/
│   │   ├── layout.tsx         # 根布局 (metadata + viewport)
│   │   ├── page.tsx           # 首页 (4大入口卡片 + 复习提醒)
│   │   ├── globals.css        # 全局样式 + CSS 变量
│   │   ├── (auth)/
│   │   │   └── login/page.tsx # 登录页
│   │   ├── (main)/
│   │   │   ├── layout.tsx     # 主布局 (顶栏 + 底导航 + 登录守卫)
│   │   │   ├── vocabulary/
│   │   │   │   ├── page.tsx   # 单词选择页 (课本/单元/模式/统计表格)
│   │   │   │   └── session/
│   │   │   │       └── page.tsx # 背诵练习页 (4模式统一入口)
│   │   │   ├── reading/
│   │   │   │   ├── page.tsx   # 阅读选择页
│   │   │   │   └── session/
│   │   │   │       └── page.tsx # 阅读练习页
│   │   │   ├── review/
│   │   │   │   └── page.tsx   # 复习页
│   │   │   └── history/
│   │   │       └── page.tsx   # 学习进度页
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── send-code/ # 发送验证码
│   │       │   ├── login/     # 登录验证
│   │       │   ├── logout/    # 退出
│   │       │   └── me/        # 当前用户
│   │       ├── words/
│   │       │   ├── list/      # GET 单词列表
│   │       │   ├── units/     # GET 课本单元树
│   │       │   ├── stats/     # GET 单词统计
│   │       │   ├── progress/  # POST 记录学习进度
│   │       │   ├── common/    # GET 常用词分类
│   │       │   ├── common-session/
│   │       │   ├── sync-common/ # POST 同步常用词翻译
│   │       │   ├── review/    # GET/POST 复习
│   │       │   └── review-count/ # GET 待复习数
│   │       ├── reading/
│   │       │   └── generate/  # GET 生成阅读材料
│   │       ├── rag/
│   │       │   ├── status/    # GET 向量库状态
│   │       │   └── ingest/    # POST 灌库
│   │       └── stats/         # GET 用户整体统计
│   ├── components/
│   │   ├── ui/
│   │   │   └── button.tsx     # 基础按钮组件
│   │   └── vocabulary/
│   │       ├── letter-sort.tsx # 字母拖拽排序
│   │       ├── drag-spell.tsx  # 排序容器 (含模式切换)
│   │       ├── letter-fill.tsx # 字母填空
│   │       └── word-choice.tsx # 3选1选择题
│   ├── hooks/
│   │   └── use-auth.ts        # auth hook
│   ├── lib/
│   │   ├── auth.ts            # JWT session 管理
│   │   ├── prisma.ts          # Prisma 客户端
│   │   ├── speech.ts          # 语音播放
│   │   ├── tts.ts             # 阿里云 TTS
│   │   ├── deepseek.ts        # DeepSeek API
│   │   ├── embedding.ts       # 文本向量化
│   │   ├── vector-store.ts    # 内存向量存储
│   │   ├── verify-code.ts     # 验证码管理
│   │   ├── sms.ts             # 短信服务
│   │   └── utils.ts           # 工具函数 (cn)
│   ├── generated/prisma/      # Prisma 生成代码
│   └── middleware.ts          # 中间件
├── bookResources/
│   ├── 四下单词.md
│   └── 四下课文.md
├── .env.local                 # 环境变量
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
└── plan.md                    # 本文件
```

---

## 五、环境变量配置

```bash
# DeepSeek API
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# 阿里云 TTS
ALIBABA_CLOUD_ACCESS_KEY_ID=LTAIxxx
ACCESS_KEY_SECRET=xxx
TTS_APP_KEY=xxx

# Jina AI Embedding
JINA_API_KEY=jina_xxx
JINA_EMBEDDING_MODEL=jina-embeddings-v3

# JWT
JWT_SECRET=xxx
```

---

## 六、剩余工作清单

### Phase 5：完善 + 部署（当前阶段）

#### 6.1 数据完善
- [ ] 导入更多课本数据（三上、三下、五上、五下、六上、六下）
- [ ] 全量单词音频预生成（当前仅四下 ~100个有MP3）
- [ ] 全量单词配图生成
- [ ] 课文内容灌入向量库

#### 6.2 功能增强
- [ ] 短信验证码接入（目前仅 dev 模式 123456）
- [ ] 音频预加载优化（首屏加载速度）
- [ ] 离线 PWA 支持（manifest.json 已配置，需 Service Worker）
- [ ] 单词发音/例句播放进度指示
- [ ] 学习提醒通知（浏览器 Notification API）
- [ ] 家长查看学习报告功能

#### 6.3 测试
- [ ] 三端响应式适配验证（手机 375px / 平板 768px / 桌面 1024px+）
- [ ] 各练习模式完整流程测试
- [ ] 复习流程正确性验证
- [ ] 阅读生成质量评估
- [ ] TTS 在主流浏览器兼容性测试

#### 6.4 性能优化
- [ ] 图片懒加载 / WebP 格式
- [ ] 音频文件预加载策略
- [ ] API 响应缓存
- [ ] 首屏加载时间优化（目标 < 2s）

#### 6.5 部署
- [ ] 数据库迁移到 PostgreSQL（生产环境）
- [ ] ICP 备案 + 域名
- [ ] HTTPS 配置
- [ ] Docker 容器化
- [ ] 云服务器部署（阿里云 ECS / 腾讯云）

#### 6.6 工程化
- [ ] 单元测试框架搭建（Vitest）
- [ ] E2E 测试（Playwright）
- [ ] CI/CD 流水线
- [ ] 错误监控（Sentry）
- [ ] 日志系统

---

## 七、已知问题 & 技术债务

| 问题 | 影响 | 优先级 | 计划 |
|------|------|--------|------|
| SQLite 不适合生产并发 | 多用户时性能下降 | 中 | 部署前迁移到 PostgreSQL |
| 内存向量存储重启丢失 | RAG 数据需重新灌入 | 中 | 迁移到 Qdrant 或持久化 JSON |
| 验证码无短信发送 | 仅 dev 模式可用 | 高 | 接入阿里云短信服务 |
| 无自动化测试 | 回归风险 | 中 | Phase 5 引入 |
| 课本数据不完整 | 只有2册+常用词 | 高 | 补充其他册别 markdown |
| 音频生成不完整 | 部分单词无预生成音频 | 低 | 浏览器 TTS 可兜底 |
| shadcn/ui 未使用 | 原计划依赖未用 | 低 | 当前自定义组件满足需求 |
| dnd-kit 未使用 | 原计划拖拽库未用 | 低 | 原生 pointer events 触屏体验可接受 |

---

## 八、与原计划的关键差异

| 决策点 | 原计划 | 实际 | 原因 |
|--------|--------|------|------|
| 数据库 | PostgreSQL (Supabase/RDS) | SQLite | 开发阶段简化，免外部依赖 |
| 认证 | NextAuth.js v5 | 自定义 JWT | 手机号登录不需要 OAuth |
| 向量库 | Qdrant | 内存 TF-IDF | Docker 无法拉取 Qdrant 镜像 |
| 组件库 | shadcn/ui | 自定义 Tailwind 组件 | 减少依赖，更灵活 |
| 拖拽库 | dnd-kit | 原生 pointer events | 减少包体积 |
| 状态管理 | Zustand/Jotai | React hooks | 应用规模不需要额外库 |
| 教材范围 | 三上至六下（8册） | 四上、四下 + 常用词 | 教材 markdown 仅提供了四下 |
| 部署 | 阿里云 ECS + Docker | 本地开发 | 功能未完全完成 |

---

## 九、成本预估（实际 vs 计划）

### 实际投入
| 项目 | 预估（原计划） | 实际 |
|------|---------------|------|
| 开发人力 | 4-6万（8周全职） | 个人开发，约3周业余时间 |
| DeepSeek API | ¥50-200/月 | 测试期间 < ¥10 |
| 阿里云 TTS | ¥20-50/月 | 预生成约100个MP3，< ¥1 |
| Jina AI Embedding | - | 免费额度内 |
| 服务器 | ¥200-300/月 | 尚未部署（¥0） |

### 预计运营成本
| 项目 | 月成本（预估） |
|------|---------------|
| 云服务器 (ECS 2核4G) | ¥100–200 |
| 数据库 (Supabase 免费版) | ¥0 |
| DeepSeek API | ¥50–200 |
| TTS (阿里云) | ¥20–50 |
| 域名 + ICP | ¥10/月（年付） |
| **合计** | **¥180–460/月** |

---

## 十、下一步行动计划

### 短期（1-2周）
1. 补充教材 markdown（三上、三下、四上、五上等下等册别）
2. 批量生成全部单词音频和配图
3. 接入真实短信验证码或添加邮箱登录备选
4. 部署到 Vercel（免备案）或国内云服务器

### 中期（2-4周）
1. 数据库迁移到 PostgreSQL
2. 向量库迁移到 Qdrant Cloud 免费版
3. 全流程测试 + bug 修复
4. 响应式适配验证

### 长期（1-2月）
1. ICP 备案 + 域名 + HTTPS
2. Docker 容器化部署
3. CI/CD + 自动化测试
4. 家长端学习报告
5. 班级管理功能（老师视角）

---

**计划作者**：Claude (Kiro AI)
**最后更新**：2026-06-15
