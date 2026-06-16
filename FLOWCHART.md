# 抖音直播间自动关注脚本 — 功能逻辑图

```mermaid
flowchart TD
    START(["🚀 启动脚本"]) --> RESET["📅 检查每日重置<br/>（如果新的一天，关注计数归零）"]
    RESET --> OPEN["📱 打开抖音 App"]
    OPEN --> POPUP["🛡️ 启动弹窗拦截线程<br/>（广告/更新/青少年模式等 8 种弹窗）"]
    POPUP --> HOME["🏠 切换到首页推荐"]
    
    HOME --> CHECK{"👀 当前屏幕<br/>是直播间？"}
    
    CHECK -->|"❌ 不是"| SWIPE["⬆️ 随机滑动刷视频<br/>sleep 2-4s 随机"]
    SWIPE --> CHECK
    
    CHECK -->|"✅ 是"| ENTER["🚪 点击进入直播间"]
    ENTER --> WAIT["⏳ 等待直播间加载<br/>（最多等 15 秒）"]
    WAIT --> LOADED{"加载成功？"}
    LOADED -->|"❌ 失败"| NEXT_ROOM
    
    LOADED -->|"✅ 成功"| OPEN_LIST["👥 打开在线观众列表"]
    
    OPEN_LIST --> LIST_OPENED{"3 种策略尝试打开：<br/>① textContains('人在看')<br/>  → 点击父容器<br/>② 直播间人数控件 ID<br/>③ 底部中间坐标点击"}
    
    LIST_OPENED -->|"全部失败"| NEXT_ROOM
    
    LIST_OPENED -->|"✅ 打开成功"| FIND_BTNS["🔍 查找观众列表中的<br/>所有'关注'按钮"]
    
    FIND_BTNS --> FIND_METHOD{"3 种查找方法：<br/>① desc('关注')  <br/>② className+desc 组合<br/>③ text('关注')"}
    
    FIND_METHOD --> PROCESS["🔄 循环处理每个关注按钮"]
    
    PROCESS --> CHECK_LIMIT{"⚠️ 达到关注上限？<br/>• 本次执行上限<br/>• 当日关注上限"}
    CHECK_LIMIT -->|"✅ 是"| END(["🏁 脚本结束"])
    
    CHECK_LIMIT -->|"❌ 否"| CHECK_GENDER{"♂️ 是否仅关注男性？"}
    CHECK_GENDER -->|"✅ 是"| IS_MALE{"该用户是男性？<br/>（在按钮附近找'男'/'女'文字）"}
    IS_MALE -->|"❌ 不是男"| PROCESS
    
    CHECK_GENDER -->|"❌ 否"| CHANCE{"🎲 概率判断<br/>（默认 90% 触发关注）"}
    IS_MALE -->|"✅ 是"| CHANCE
    
    CHANCE -->|"❌ 没中"| PROCESS
    
    CHANCE -->|"✅ 中了"| TAP["👆 随机偏移点击关注按钮<br/>（偏移 5-30px，按压 50-150ms）"]
    TAP --> DELAY["⏱️ 随机延时 3-8 秒<br/>（双峰分布模拟人类）"]
    DELAY --> FOLLOWED["📊 计数 +1<br/>✓ 已关注"]
    FOLLOWED --> NEXT_BTN["下一个关注按钮"]
    NEXT_BTN --> CHECK_LIMIT
    
    PROCESS --> SCROLL_CHECK{"当前页面<br/>还有更多按钮？"}
    SCROLL_CHECK -->|"✅ 有"| PROCESS
    
    SCROLL_CHECK -->|"❌ 没有或≤1个"| SCROLL["📜 滚动观众列表<br/>（最多滚 3 次）"]
    SCROLL --> SCROLL_AGAIN{"连续 2 次<br/>都是空的？"}
    SCROLL_AGAIN -->|"❌ 否"| FIND_BTNS
    SCROLL_AGAIN -->|"✅ 是"| CLOSE_LIST["❌ 关闭观众列表"]
    
    CLOSE_LIST --> NEXT_ROOM["📲 滑动到下一个直播间"]
    NEXT_ROOM --> CHECK
    
    %% 样式
    classDef action fill:#4A90D9,color:#fff,stroke:#357ABD
    classDef decision fill:#F5A623,color:#fff,stroke:#D4891F
    classDef startend fill:#7ED321,color:#fff,stroke:#5FA812
    classDef sub fill:#F8E71C,color:#333,stroke:#D4C415
    
    class OPEN,POPUP,HOME,ENTER,OPEN_LIST,FIND_BTNS,TAP,DELAY,SCROLL,CLOSE_LIST,SWIPE action
    class CHECK,LOADED,LIST_OPENED,FIND_METHOD,CHECK_LIMIT,CHECK_GENDER,IS_MALE,CHANCE,SCROLL_CHECK,SCROLL_AGAIN decision
    class START,END startend
    class RESET,WAIT,NEXT_ROOM,NEXT_BTN,FOLLOWED sub
```

---

## 🔄 核心数据流

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  配置存储     │     │  反检测工具   │     │  控件选择器   │
│  follower-   │◄────│  anti-       │     │  widget.js   │
│  Config.js   │     │  Detection   │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────────────────────────────────────────────┐
│               liveRoomFollower.js                     │
│                                                       │
│  main() → while(未达到上限) → {                       │
│    if (在直播间) → doLiveRoomFollow()                 │
│    else → swipe()                                     │
│  }                                                    │
│                                                       │
│  doLiveRoomFollow():                                  │
│    1. enter live room                                 │
│    2. openViewerList()  ←── 3 strategies              │
│    3. processViewerList() ←── while + scroll + follow │
│    4. closeViewerList()                               │
│    5. swipe to next room                              │
│  }                                                    │
└──────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│  原项目基础设施 │
│  util.js      │
│  openApp.js   │
│  douyinUtils  │
│  closePopup   │
└──────────────┘
```

---

## ⏱️ 反检测时间线

```
进入直播间            打开观众列表            关注第1人             关注第2人             切换直播间
   │                     │                     │                    │                    │
   ├── sleep 2-5s ──────┤                     │                    │                    │
   │                     ├── sleep 2s ────────┤                    │                    │
   │                     │                     ├─ sleep 3-8s ──────┤                    │
   │                     │                     │                    ├─ sleep 3-8s ───────┤
   │                     │                     │                    │                    ├─ sleep 1.5s ──→
   │                     │                     │                    │                    │
   ▼                     ▼                     ▼                    ▼                    ▼
  随机偏移              随机偏移              随机偏移             随机偏移             贝塞尔曲线
  5-30px                5-30px                5-30px               5-30px               +随机速度
```

---

## 📊 关键配置项及作用

| 配置 | 默认值 | 作用 |
|------|--------|------|
| 关注间隔 | 3-8 秒 | 每次关注后随机等待，太快会被风控 |
| 点击偏移 | 5-30px | 不点固定坐标，模拟人手 |
| 单次上限 | 20 人 | 一次执行最多关注数 |
| 单日上限 | 80 人 | 一天最多关注数，防止封号 |
| 关注概率 | 90% | 不是每个符合条件的都关注，留 10% 容错 |
| 滚动次数 | 3 次 | 每个直播间最多翻 3 次列表 |
