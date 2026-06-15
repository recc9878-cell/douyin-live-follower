# 抖音直播间自动关注脚本 · 完整开发文档

> 基于 [Dylanchouxd/Autojs_Douyin](https://github.com/Dylanchouxd/Autojs_Douyin) (⭐535) 二次开发
>
> 创建日期：2026-06-15 | 运行环境：Autox.js（无障碍服务，非 root）

---

## 目录

- [一、需求概述](#一需求概述)
- [二、技术方案](#二技术方案)
- [三、项目结构](#三项目结构)
- [四、核心流程设计](#四核心流程设计)
- [五、文件清单与修改计划](#五文件清单与修改计划)
- [六、选择器适配指南](#六选择器适配指南)
- [七、反检测策略](#七反检测策略)
- [八、配置项说明](#八配置项说明)
- [九、长期维护手册](#九长期维护手册)
- [十、开发环境搭建](#十开发环境搭建)
- [十一、运行与调试](#十一运行与调试)
- [十二、常见问题](#十二常见问题)

---

## 一、需求概述

### 目标

在安卓手机上自动执行以下流程：

```
进入抖音直播间
  → 打开在线观众列表
  → 筛选男性用户
  → 逐个点击关注（带随机延时 + 随机落点）
  → 关注完所有男性用户
  → 自动滑动到下一个直播间
  → 循环执行
```

### 关键要求

| 要求 | 说明 |
|------|------|
| 非 root | 使用 Android 无障碍服务（AccessibilityService） |
| 防检测 | 操作间隔随机 3-8s，点击坐标在按钮内随机偏移 5-30px |
| 异常处理 | 弹窗、网络超时、直播间结束、空列表等都能处理 |
| 长期维护 | 选择器集中管理，配置与逻辑分离，抖音版本更新只需改选择器 |

---

## 二、技术方案

### 为什么选 Autox.js

| 方案 | 运行方式 | Root 需求 | UI 识别 | 长期维护 | 费用 |
|------|---------|-----------|---------|---------|------|
| **Autox.js** ✅ | 手机独立运行 | ❌ 无 | Selector + OCR | 选配分离，改 ID 即可 | 免费 |
| uiautomator2 | 需连电脑 | ❌ 无 | UI Automator | 不能脱离电脑 | 免费 |
| Appium | 需连电脑 | ❌ 无 | WebDriver | 太重 | 免费 |
| EasyClick | 手机独立运行 | ❌ 无 | 图像+UI树 | IDE完善 | 付费 |
| 按键精灵 | 手机独立运行 | ❌ 无 | 图像匹配 | 不支持JS | 付费 |

### 技术栈

- **运行时**: [Autox.js](https://github.com/kkevsekk1/AutoX)（基于 Auto.js 4.1 的增强版，无软件限制）
- **语言**: JavaScript（Autox.js 内置 Rhino 引擎）
- **UI 识别**: AccessibilityService 控件选择器（`id()` / `text()` / `desc()`）
- **UI 配置**: Autox.js 内置 UI 框架（类 XML 布局）
- **数据持久化**: `storages.create()` 本地键值存储

---

## 三、项目结构

```
/Users/rec/Desktop/抖音脚本开发/
├── README2.md                          # 本文档 — 完整开发说明
├── douyin-follower-bot/                # 项目根目录（Fork 自 Dylanchouxd/Autojs_Douyin）
│   ├── README.md                       # 原项目说明
│   ├── yanghao_tools/                  # ====== 养号助手（主力模块）======
│   │   ├── project.json                # Autox.js 项目配置
│   │   ├── ui.js                       # ✅ 【已修改】UI 配置页（新增「直播间关注」Tab）
│   │   ├── modules/
│   │   │   ├── douyinDaliyWork.js       # 原养号每日任务（不动）
│   │   │   ├── douyinNewWork.js         # 原养号新号任务（不动）
│   │   │   └── liveRoomFollower.js      # 🆕 【新增】直播间自动关注核心模块
│   │   ├── config/
│   │   │   ├── storageDaliy.js          # 原养号配置（不动）
│   │   │   ├── storageNew.js            # 原新号配置（不动）
│   │   │   └── followerConfig.js        # 🆕 【新增】关注脚本配置存储
│   │   ├── utils/
│   │   │   ├── util.js                  # 原工具函数（随机滑动/点击/延时）
│   │   │   ├── widget.js               # ✅ 【已修改】控件选择器（新增观众列表相关 ID）
│   │   │   ├── antiDetection.js         # 🆕 【新增】增强反检测工具函数
│   │   │   ├── douyinUtils.js           # 原抖音工具函数（不动）
│   │   │   ├── douyinClosePopup.js      # 原弹窗处理（不动）
│   │   │   ├── openApp.js              # 原打开 APP（不动）
│   │   │   └── dayjs.1.11.6.min.js     # 时间库（不动）
│   │   └── statics/                     # 控件位置参考图
│   └── interactive_tools/               # 快手互动助手（不动）
└── README2.md
```

---

## 四、核心流程设计

### 4.1 完整流程图

```
main()
  │
  ├─ 1. 打开抖音 App
  ├─ 2. 启动弹窗拦截线程（douyinClosePopup）
  ├─ 3. 切换到首页推荐
  │
  └─ startMissionLoop()  ←──────┐
       │                        │（循环）
       ├─ 判断是否在直播间？      │
       │   ├─ 是 → startLiveRoomFollower()
       │   │      ├─ 打开在线观众列表按钮
       │   │      ├─ 等待观众列表加载
       │   │      ├─ 筛选男性用户
       │   │      ├─ 循环处理观众列表：
       │   │      │   ├─ 获取当前可见的所有观众项
       │   │      │   ├─ 遍历每个观众：
       │   │      │   │   ├─ 检查性别（通过 UI 文本或图标）
       │   │      │   │   ├─ 如果是男性 → 点"关注"按钮
       │   │      │   │   │   ├─ 随机延时 3-8 秒
       │   │      │   │   │   └─ 随机点击偏移
       │   │      │   │   ├─ 如果已关注/私密 → 跳过
       │   │      │   │   └─ 下一个
       │   │      │   ├─ 滑到列表下一页（加载更多观众）
       │   │      │   └─ 重复直到所有男性处理完毕
       │   │      ├─ 关闭观众列表
       │   │      └─ 滑到下一个直播间 → 回到 startMissionLoop()
       │   │
       │   └─ 否 → 滑动刷视频，直到遇到直播间
       │
       └───────────────────┘
```

### 4.2 与原项目的关键差别

| 步骤 | 原项目 (douyinDaliyWork) | 本项目 (liveRoomFollower) |
|------|------------------------|--------------------------|
| 用户来源 | 直播间评论区发言的用户 | 在线观众列表 |
| 获取方式 | 监听 `text` 控件获取评论 | 打开观众列表浮层 |
| 筛选方式 | 点用户名进详情页看性别 | 从列表 UI 直接判断性别 |
| 关注方式 | 在用户详情页点关注 | 在观众列表项上直接点关注 |
| 滑动逻辑 | 时间到（60-120s）就滑走 | 观众列表处理完才滑走 |

---

## 五、文件清单与修改计划

### 5.1 新建文件

#### （1）`yanghao_tools/utils/antiDetection.js` — 增强反检测模块

职责：提供比原项目更精细的真人模拟函数。

```
函数清单：
- humanLikeDelay(min, max)        → 随机延时 + 微小抖动（模拟人类反应不一致）
- randomTapInBounds(bounds)        → 在控件边界内随机偏移 5-30px 点击
- randomTapInRegion(left,top,w,h) → 在指定区域内随机点击
- humanLikeSwipe(x1,y1,x2,y2)     → 贝塞尔曲线滑动（比原版更多控制点）
- randomScrollList(direction)     → 随机速度/距离滑动列表
- randomPauseBetweenActions()     → 操作间随机停顿（3-8s）
```

#### （2）`yanghao_tools/config/followerConfig.js` — 配置存储

职责：管理所有可配置参数，与 UI 绑定。

```
配置项：
- 关注间隔时间（随机范围 3-8s）
- 点击偏移范围（5-30px）
- 单次执行关注上限
- 单日关注上限
- 观众列表滚动次数
- 是否启用性别筛选（默认男性）
- 日志级别
```

#### （3）`yanghao_tools/modules/liveRoomFollower.js` — 核心模块

职责：实现完整的直播间观众关注流程。

```
模块结构：
- main()                          — 入口：打开App → 开始任务循环
- startMissionLoop()              — 主循环：判断直播间 → 执行关注 → 下一个
- enterLiveRoomAndFollow()        — 进入直播间并开始关注流程
- openViewerList()                — 打开在线观众列表
- waitForViewerListLoaded()       — 等待观众列表加载完成
- filterMaleUsers()               — 筛选男性用户
- processViewerList()             — 循环处理观众列表
- isMaleUser(viewerItem)          — 判断观众是否为男性
- clickFollowButton(viewerItem)   — 点击关注按钮（带随机偏移）
- scrollViewerList()              — 滑动观众列表加载更多
- closeViewerList()               — 关闭观众列表
- swipeToNextLive()               — 滑动到下一个直播间
- checkLimits()                   — 检查关注上限
```

### 5.2 修改文件

#### （4）`yanghao_tools/utils/widget.js` — 新增选择器

新增观众列表相关的控件 ID 占位符（需用户用 Autox.js 布局分析获取实际 ID）：

```javascript
// === 新增：观众列表相关控件 ===
const liveViewerListButton = 'com.ss.android.ugc.aweme:id/xxx' // 在线观众按钮
const liveViewerListPanel = 'com.ss.android.ugc.aweme:id/xxx'  // 观众列表面板
const liveViewerListItem = 'com.ss.android.ugc.aweme:id/xxx'   // 观众列表项
const liveViewerGenderIcon = 'com.ss.android.ugc.aweme:id/xxx' // 性别图标
const liveViewerFollowBtn = 'com.ss.android.ugc.aweme:id/xxx'  // 列表关注按钮
const liveViewerFilterBtn = 'com.ss.android.ugc.aweme:id/xxx'  // 筛选按钮
const liveViewerFilterMale = 'com.ss.android.ugc.aweme:id/xxx' // 筛选-男性选项
const liveViewerClose = 'com.ss.android.ugc.aweme:id/xxx'      // 关闭观众列表
```

#### （5）`yanghao_tools/ui.js` — 新增 Tab

在现有 Tabs 中新增一个「直播间关注」Tab，包含：
- 状态展示（当日已关注人数）
- 关注延时设置
- 关注上限设置
- 运行按钮

#### （6）`yanghao_tools/project.json` — 版本号更新

```json
{
  "name": "抖音脚本合集",
  "versionName": "1.4.0",
  "packageName": "com.nice.douyin.script.all"
}
```

---

## 六、选择器适配指南

### 6.1 获取控件 ID 的方法

用 Autox.js 的「布局分析」功能抓取当前抖音版本的控件 ID：

1. 打开 Autox.js App
2. 点击浮动按钮 → 选择「布局分析」
3. 打开抖音 → 进入直播间 → 点击在线观众列表
4. 在布局分析界面点击观众列表的各个元素
5. 记录每个元素的 `id` 属性值

### 6.2 常见控件及其识别策略

| 控件 | 首选策略（id） | 备选策略（text/desc） |
|------|---------------|---------------------|
| 在线观众按钮 | `id(xxx)` | `desc("在线观众")` 或 `textMatches(/\d+人正在看/)` |
| 观众列表面板 | `id(xxx)` | 检测列表容器可见性 |
| 关注按钮 | `id(xxx)` | `text("关注")` + `className("Button")` |
| 男性性别标识 | `id(xxx)` | 图标 desc 含"男" 或 头像框颜色 |
| 筛选按钮 | `id(xxx)` | `desc("筛选")` |
| 关闭按钮 | `id(xxx)` | `desc("关闭")` 或 `back()` |
| 观众列表项 | `id(xxx)` | 按坐标范围遍历子元素 |

### 6.3 版本适配流程

```
抖音版本更新 → 控件 ID 变化
                ↓
        情况 A：已有旧版 APK
                → 豌豆荚下载历史版本（v30.1.0）
                → 卸载新版，安装旧版
                → 脚本继续可用
                ↓
        情况 B：必须用新版
                → 用布局分析工具获取新 ID
                → 只修改 widget.js 中的 ID 值
                → 逻辑代码完全不动
```

---

## 七、反检测策略

### 7.1 时间随机化

```
┌─────────────────────────────────────┐
│  操作类型        延时范围             │
│─────────────────────────────────────│
│  打开观众列表后    1.5 - 3.5s        │
│  两个关注之间      3.0 - 8.0s        │
│  滑动列表后        1.0 - 2.5s        │
│  关闭列表后        1.0 - 2.0s        │
│  切直播间前        0.5 - 1.5s        │
│  每次点击前        0.3 - 0.8s 抖动    │
└─────────────────────────────────────┘
```

### 7.2 点击随机化

- 不直接调用 `click()`，而是用 `press(x, y, duration)`
- 每次点击坐标在控件 bounds 范围内随机偏移 **5-30px**
- 点击按压时长随机 **50-150ms**
- 偶尔（5% 概率）模拟"滑偏了再纠正"的动作

### 7.3 滑动随机化

- 使用 4 控制点贝塞尔曲线（已由原项目 `smlMove()` 实现）
- 起点/终点每次随机偏移 ±50px
- 滑动速度随机 ±20%
- 偶尔（10% 概率）模拟"滑到一半停顿一下"再继续

### 7.4 行为随机化

- 不是每个男性都关注（90% 概率触发关注）
- 偶尔在关注前停顿更久（模拟"查看资料"的行为）
- 关注上限：单次执行 ≤ 20 人，单日 ≤ 80 人（可在配置调整）

---

## 八、配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `followMinDelay` | number | 3000 | 关注最小间隔（ms） |
| `followMaxDelay` | number | 8000 | 关注最大间隔（ms） |
| `tapOffsetMin` | number | 5 | 点击最小偏移（px） |
| `tapOffsetMax` | number | 30 | 点击最大偏移（px） |
| `followMaleOnly` | boolean | true | 是否仅关注男性 |
| `sessionFollowLimit` | number | 20 | 单次执行关注上限 |
| `dayFollowLimit` | number | 80 | 单日关注上限 |
| `maxScrollsPerRoom` | number | 3 | 每个直播间最多滑几次列表 |
| `scrollDelayMin` | number | 1000 | 滚动后最小等待（ms） |
| `scrollDelayMax` | number | 2500 | 滚动后最大等待（ms） |
| `followProbability` | number | 0.9 | 符合条件时关注概率 |
| `debugMode` | boolean | true | 是否输出详细日志 |

---

## 九、长期维护手册

### 9.1 抖音版本更新时的操作

```
1. 发现脚本不工作了
    ↓
2. 确认抖音版本
    → 设置 → 关于抖音 → 查看版本号
    ↓
3. 方案 A（推荐）：回退到适配版本
    → 豌豆荚搜索抖音 → 历史版本 → 下载 v30.1.0
    → 安装后关闭自动更新
    ↓
4. 方案 B：更新选择器
    → 打开 Autox.js → 布局分析
    → 进入直播间 → 观众列表 → 获取新 ID
    → 编辑 yanghao_tools/utils/widget.js → 更新 ID
    → 保存后重新运行
```

### 9.2 代码更新流程

```bash
# 电脑端开发
cd /Users/rec/Desktop/抖音脚本开发/douyin-follower-bot
# 改代码 → commit → push

# 手机端更新方式（二选一）
# 方式 1：USB 传输
cp -r yanghao_tools /手机存储/Autox.js/脚本/

# 方式 2：Git 同步（需要手机装 Termux）
cd ~/Autox.js/脚本/douyin-follower-bot
git pull
```

### 9.3 日志管理

- 所有关键操作都有 `toastLog()` 输出
- 在 Autox.js 中连续点击标题 6 次可打开日志控制台
- 日志文件保存在 Autox.js 的日志目录中

---

## 十、开发环境搭建

### 10.1 手机端

1. 下载安装 [Autox.js](https://github.com/kkevsekk1/AutoX/releases) APK
2. 开启「无障碍服务」→ 选择 Autox.js
3. 开启「悬浮窗权限」
4. 将 `yanghao_tools/` 整个文件夹传到手机
5. 在 Autox.js 中导入项目（`project.json` 所在的目录）

### 10.2 电脑端

```bash
# 已克隆到桌面
cd /Users/rec/Desktop/抖音脚本开发/douyin-follower-bot

# 查看当前抖音适配版本（widget.js 中维护）
# 查看 statics/ 目录获取控件位置参考图

# 代码编辑后通过以下方式传到手机：
# - USB 数据线复制
# - 微信/QQ 传到手机
# - 自建 HTTP 服务 + 手机下载
```

---

## 十一、运行与调试

### 11.1 正常运行

1. 手机打开 Autox.js
2. 导入 `yanghao_tools/` 项目
3. 切换到「直播间关注」Tab
4. 设置参数（延时、上限等）
5. 点击「运行」
6. 脚本自动打开抖音开始工作

### 11.2 调试模式

```javascript
// 在 liveRoomFollower.js 中设置
const DEBUG = true  // 开启详细日志

// 单独测试某个子流程
// 在 ui.js 中取消注释底部调试代码
// threads.start(function () {
//   testOpenViewerList()  // 只测试打开观众列表
// })
```

### 11.3 关注上限重置

脚本每天首次运行会自动重置当日关注计数。如需手动重置：
- 在 Autox.js 中清除应用数据
- 或删除 `storages` 中的 `FollowerBot__Config` 键值

---

## 十二、常见问题

### Q: 脚本点了观众列表没反应？
A: 控件 ID 可能变了。参考第六章更新 `widget.js` 中的选择器。

### Q: 为什么筛选不出男性？
A: 抖音观众列表可能不直接显示性别。备选方案：跳过性别筛选，从昵称/头像风格判断，或全部关注。

### Q: 关注太快会被封吗？
A: 默认 3-8s 间隔 + 90% 概率 + 单次上限 20 人，模拟真人操作。如果仍被风控，建议增大间隔和降低上限。

### Q: 运行中弹窗挡住了怎么办？
A: 弹窗拦截线程 `douyinClosePopup` 一直在后台运行，覆盖了 8 种常见弹窗。如果有新类型弹窗，在 `douyinClosePopup.js` 中追加处理。

### Q: 如何适配新版抖音？
A: 参考 9.1 节 — 优先回退版本，其次是更新选择器。

### Q: 脚本退出后抖音还在后台？
A: 脚本不会主动关闭抖音。如需退出时关闭，在 `main()` 最后加 `app.killApp()`。
