/**
 * 抖音直播间自动关注 — 核心模块（简洁版）
 *
 * 核心流程：
 *   打开抖音 → 刷到直播间 → 进直播间 → 开观众列表 → 循环关注 → 切下一个
 *
 * 设计原则：
 *   1. 关注按钮用 desc("关注") + className("android.widget.Button") 匹配
 *      （这是社区验证的最稳定方案，不依赖易变的控件 ID）
 *   2. 观众列表用 RecyclerView 容器遍历 + desc("关注") 定位
 *   3. 所有点击带随机偏移 5-30px，所有延时 3-8s 随机
 *   4. 宁可漏关注也不要被风控（概率关注 + 数量上限）
 *
 * @see README2.md 完整开发文档
 */

(() => {
  // ============================================================
  // 依赖
  // ============================================================
  const { toIndexPage } = require('../utils/douyinUtils')
  const { randomSleep, randomSwipe, liveSwipe, clickContent } = require('../utils/util')
  const douyinClosePopup = require('../utils/douyinClosePopup')
  const openApp = require('../utils/openApp')
  const config = require('../config/followerConfig')
  const anti = require('../utils/antiDetection')
  const { livePersonAmountWidget } = require('../utils/widget')

  // ============================================================
  // 入口
  // ============================================================
  function main() {
    toastLog('【抖音】直播间自动关注脚本启动')

    // 每日重置
    checkDailyReset()
    toastLog('当日已关注: ' + config.dayFollowedAmount() + '/' + config.dayFollowLimit() + ' 人')

    // 打开抖音
    openApp('抖音')
    douyinClosePopup() // 启动弹窗拦截（后台线程）
    randomSleep(2000)
    toIndexPage() // 切换到首页推荐
    toastLog('页面加载中...')
    randomSleep(5000)

    // 开始主循环（用 while 替代递归，防栈溢出）
    toastLog('开始刷直播间...')
    while (!hitLimits()) {
      try {
        if (isInLiveRoom()) {
          toastLog('发现直播间，进入')
          doLiveRoomFollow()
          if (hitLimits()) break
        } else {
          // 不在直播间 → 滑动找直播间（用单独变量控制时长，不用 randomSleep 双参）
          sleep(rand(2000, 4000))
          randomSwipe()
          sleep(rand(2000, 4000))
        }
      } catch (e) {
        log('主循环异常: ' + e)
        sleep(3000)
      }
    }
    toastLog('脚本执行完毕，已到达关注上限或任务结束')
  }

  // ============================================================
  // 每日重置
  // ============================================================
  function checkDailyReset() {
    const dayjs = require('../utils/dayjs.1.11.6.min')
    const today = dayjs(new Date().getTime()).format('YYYY-MM-DD')
    const lastRun = dayjs(config.lastRunTime()).format('YYYY-MM-DD')
    if (today !== lastRun) {
      config.resetDayFollowed()
      toastLog('新的一天，关注计数已重置')
    }
  }

  // ============================================================
  // 主循环
  // ============================================================
  let sessionCount = 0 // 本次执行已关注人数

  /** 检查是否达到关注上限 */
  function hitLimits() {
    if (sessionCount >= config.sessionFollowLimit()) {
      toastLog('达到本次执行上限 (' + sessionCount + '/' + config.sessionFollowLimit() + ')，已停止')
      return true
    }
    if (config.dayFollowedAmount() >= config.dayFollowLimit()) {
      toastLog('达到当日上限 (' + config.dayFollowedAmount() + '/' + config.dayFollowLimit() + ')，明天再来')
      return true
    }
    return false
  }

  /** 是否在直播间 */
  function isInLiveRoom() {
    return desc('点击进入直播间按钮').exists() ||
           text('更多直播').exists() ||
           id(livePersonAmountWidget).exists()
  }

  // ============================================================
  // 直播间关注全流程
  // ============================================================
  function doLiveRoomFollow() {
    // 1. 点进直播间（如果在推荐流上还没进去）
    if (!text('更多直播').exists()) {
      clickContent('点击进入直播间按钮', 'desc')
      // 等直播间加载（最多等 15s）
      for (let i = 0; i < 15; i++) {
        if (text('更多直播').exists() || id(livePersonAmountWidget).exists()) break
        sleep(1000)
      }
    }

    // 确认是否成功进入
    if (!text('更多直播').exists() && !id(livePersonAmountWidget).exists()) {
      toastLog('进入直播间失败，跳过')
      swipeToNext()
      return
    }
    toastLog('已进入直播间')

    // 2. 打开在线观众列表
    if (!openViewerList()) {
      toastLog('打不开观众列表，切下一个')
      swipeToNext()
      return
    }

    // 2.5 筛选男性用户（如果列表有筛选功能）
    if (config.followMaleOnly()) {
      filterMaleUsers()
    }

    // 3. 处理观众列表 → 关注男性用户
    const followed = processViewerList()

    // 4. 关闭观众列表
    closeViewerList()

    toastLog('本直播间关注了 ' + followed + ' 人')
    sessionCount += followed

    // 5. 滑到下一个直播间
    swipeToNext()
  }

  // ============================================================
  // 打开观众列表
  // ============================================================
  function openViewerList() {
    toastLog('打开观众列表...')

    // 策略1（推荐）：点击"人在看"文字的父容器
    // 社区经验：textContains("人在看") 找到人数文字，它的父容器是可点击的观众入口
    try {
      const viewerText = textContains('人在看').findOne(2000)
      if (viewerText) {
        const parent = viewerText.parent()
        if (parent) {
          toastLog('点击人数区域')
          anti.randomTap(parent)
          sleep(2000)
          if (isViewerListOpen()) return true
        }
        // 父容器不行就点文字本身
        anti.randomTap(viewerText)
        sleep(2000)
        if (isViewerListOpen()) return true
      }
    } catch (e) { log('人数区域点击失败: ' + e) }

    // 策略2：点击直播间人数 id
    try {
      if (id(livePersonAmountWidget).exists()) {
        anti.randomTap(id(livePersonAmountWidget).findOnce())
        sleep(2000)
        if (isViewerListOpen()) return true
      }
    } catch (e) { log('id方法失败: ' + e) }

    // 策略3：直播间底部中间区域坐标点击
    toastLog('尝试坐标点击观众入口')
    const w = device.width, h = device.height
    const points = [
      { x: w * 0.5, y: h - 130 },
      { x: w * 0.55, y: h - 110 },
      { x: w * 0.45, y: h - 150 },
      { x: w * 0.6, y: h - 120 },
    ]
    for (const pt of points) {
      press(pt.x, pt.y, anti.pressDuration())
      sleep(2000)
      if (isViewerListOpen()) {
        toastLog('观众列表已打开')
        return true
      }
    }

    toastLog('无法打开观众列表')
    return false
  }

  /** 判断观众列表是否已打开 */
  function isViewerListOpen() {
    return className('androidx.recyclerview.widget.RecyclerView').exists() ||
           text('在线观众').exists() || text('观众列表').exists() ||
           desc('关闭').visibleToUser().exists()
  }

  // ============================================================
  // 处理观众列表（核心循环）
  // ============================================================
  function processViewerList() {
    const maxScrolls = config.maxScrollsPerRoom()
    let followed = 0
    let scrollCount = 0
    let emptyCount = 0 // 连续空滚动计数

    toastLog('开始处理观众列表')

    while (scrollCount < maxScrolls) {
      if (hitLimits()) break

      // 找到当前可见的所有"关注"按钮
      const followBtns = findFollowButtonsInList()

      // 如果没有更多关注按钮，提前结束
      if (followBtns.length === 0) {
        emptyCount++
        if (emptyCount >= 2) {
          toastLog('没有更多可关注的用户')
          break
        }
      } else {
        emptyCount = 0
      }

      // 遍历关注按钮
      let processedThisScroll = false
      for (const btn of followBtns) {
        if (hitLimits()) break
        if (!btn || !btn.visibleToUser()) continue

        try {
          // 检查性别
          if (config.followMaleOnly() && !isMaleNearButton(btn)) {
            continue
          }

          // 概率关注
          if (!anti.chance(config.followProbability())) {
            continue
          }

          // 点关注
          anti.randomTap(btn, config.tapOffsetMin(), config.tapOffsetMax())
          followed++
          config.incrementDayFollowed()
          processedThisScroll = true

          toastLog('已关注 ✓ (' + config.dayFollowedAmount() + '/' + config.dayFollowLimit() + ')')

          // 随机延时 3-8 秒
          anti.randomDelay(config.followMinDelay(), config.followMaxDelay())
        } catch (e) {
          log('关注异常: ' + e)
        }
      }

      // 如果当前页有操作或按钮不多，尝试滚动
      if (followBtns.length <= 1) {
        scrollCount++
        if (scrollCount < maxScrolls) {
          toastLog('滚动列表 (' + scrollCount + '/' + maxScrolls + ')')
          anti.scrollDown()
        }
      } else if (!processedThisScroll) {
        // 有按钮但都没处理（概率跳过或非男性），滚一下试试
        scrollCount++
        if (scrollCount < maxScrolls) {
          anti.scrollDown()
        }
      }
    }

    return followed
  }

  // ============================================================
  // 性别筛选（列表级）
  // ============================================================

  /**
   * 在观众列表中找到并点击"筛选"按钮，选择男性
   *
   * 抖音观众列表顶部通常有"全部"、"男"、"女"等筛选标签，
   * 或者有"筛选"按钮。如果有，直接选"男"让列表只显示男性用户。
   * 如果没有筛选功能，fallback 到 per-user 判断。
   */
  function filterMaleUsers() {
    toastLog('尝试筛选男性用户...')

    // 策略1：点击"全部"标签区域 → 展开筛选选项 → 选"男"
    // 观众列表顶部通常有"全部/男/女"三个 tab
    try {
      // 先看看有没有"全部"标签（有说明是 tab 筛选模式）
      if (text('全部').visibleToUser().exists()) {
        log('发现筛选标签，尝试选择"男"')
        const maleTab = text('男').findOnce(1000)
        if (maleTab && maleTab.visibleToUser()) {
          anti.randomTap(maleTab)
          sleep(1500)
          toastLog('已筛选：只看男性')
          return
        }
        // "男"不可见 → 可能被折叠了，先点"全部"展开
        const allTab = text('全部').findOnce(1000)
        if (allTab && allTab.visibleToUser()) {
          anti.randomTap(allTab)
          sleep(1000)
          // 展开后再找"男"
          const maleTab2 = text('男').findOnce(1000)
          if (maleTab2 && maleTab2.visibleToUser()) {
            anti.randomTap(maleTab2)
            sleep(1500)
            toastLog('已筛选：只看男性')
            return
          }
        }
      }
    } catch (e) { log('筛选标签模式失败: ' + e) }

    // 策略2：找"筛选"或"排序"按钮
    try {
      const filterKeywords = ['筛选', '排序', '全部']
      for (const kw of filterKeywords) {
        if (text(kw).visibleToUser().exists()) {
          const filterBtn = text(kw).findOnce(1000)
          if (filterBtn) {
            anti.randomTap(filterBtn)
            sleep(1500)

            // 在弹出的面板中选"男"
            const maleOpt = text('男').findOnce(1500)
            if (maleOpt && maleOpt.visibleToUser()) {
              anti.randomTap(maleOpt)
              sleep(500)

              // 点确定/完成
              if (text('确定').visibleToUser().exists()) {
                clickContent('确定', 'text')
              } else if (desc('完成').visibleToUser().exists()) {
                clickContent('完成', 'desc')
              }

              sleep(1500)
              toastLog('已筛选：只看男性')
              return
            }
          }
        }
      }
    } catch (e) { log('筛选按钮模式失败: ' + e) }

    // 策略3：找 desc 中的筛选相关按钮
    try {
      if (desc('筛选').visibleToUser().exists()) {
        clickContent('筛选', 'desc')
        sleep(1500)
        const maleOpt = text('男').findOnce(1500)
        if (maleOpt && maleOpt.visibleToUser()) {
          anti.randomTap(maleOpt)
          sleep(500)
          if (text('确定').exists()) clickContent('确定', 'text')
          sleep(1500)
          toastLog('已筛选：只看男性')
          return
        }
      }
    } catch (e) { log('desc筛选模式失败: ' + e) }

    // 都没有筛选功能 → 后续 processViewerList 中会逐个判断性别
    toastLog('列表无筛选功能，将在关注时逐个识别性别')
  }

  // ============================================================
  // 查找关注按钮
  // ============================================================
  function findFollowButtonsInList() {
    const btns = []

    // 方法1（最推荐）：desc("关注") 直接匹配
    // 社区验证：desc 属性比 className+desc 组合更稳定，抖音版本更新时 desc 很少变
    try {
      const els = desc('关注').find()
      for (const el of els) {
        if (el && el.visibleToUser() && isInsideViewerList(el)) {
          btns.push(el)
        }
      }
      if (btns.length > 0) return btns
    } catch (e) { log('方法1异常: ' + e) }

    // 方法2：className + desc 组合匹配
    try {
      const followEls = className('android.widget.Button').desc('关注').find()
      for (const el of followEls) {
        if (el && el.visibleToUser() && isInsideViewerList(el)) {
          btns.push(el)
        }
      }
      if (btns.length > 0) return btns
    } catch (e) { log('方法2异常: ' + e) }

    // 方法3：text("关注") 查找（备选）
    try {
      const textEls = text('关注').find()
      for (const el of textEls) {
        if (el && el.visibleToUser() && isInsideViewerList(el)) {
          try {
            const parent = el.parent()
            btns.push(parent && parent.clickable() ? parent : el)
          } catch (e) {
            btns.push(el)
          }
        }
      }
      return btns
    } catch (e) { log('方法3异常: ' + e) }

    return btns
  }

  /** 判断控件是否在观众列表面板内 */
  function isInsideViewerList(el) {
    try {
      if (className('androidx.recyclerview.widget.RecyclerView').exists()) {
        const listView = className('androidx.recyclerview.widget.RecyclerView').findOnce()
        if (listView) {
          const lb = listView.bounds()
          const eb = el.bounds()
          if (lb && eb) {
            return eb.top >= lb.top && eb.bottom <= lb.bottom
          }
        }
      }
    } catch (e) { /* 无法判断时默认在列表内 */ }
    return true
  }

  // ============================================================
  // 性别判断（简化版）
  // ============================================================
  function isMaleNearButton(btn) {
    try {
      const btnBounds = btn.bounds()
      if (!btnBounds) return true

      const scanLeft = btnBounds.left - 300
      const scanRight = btnBounds.right
      const scanTop = btnBounds.top - 20
      const scanBottom = btnBounds.bottom + 20

      // 在按钮附近找"男"或"女"文字
      const maleEl = text('男').findOnce(100)
      const femaleEl = text('女').findOnce(100)

      if (maleEl) {
        try {
          const mb = maleEl.bounds()
          if (mb && mb.left >= scanLeft && mb.right <= scanRight &&
              mb.top >= scanTop && mb.bottom <= scanBottom) return true
        } catch (e) { /* ignore */ }
      }

      if (femaleEl) {
        try {
          const fb = femaleEl.bounds()
          if (fb && fb.left >= scanLeft && fb.right <= scanRight &&
              fb.top >= scanTop && fb.bottom <= scanBottom) return false
        } catch (e) { /* ignore */ }
      }

      // 搜索按钮的父级和兄弟级控件文字
      try {
        const texts = collectNearText(btn)
        for (const t of texts) {
          if (t === '男') return true
          if (t === '女') return false
        }
      } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }

    return true // 无法判断时默认为男性
  }

  function collectNearText(btn) {
    const texts = []
    try {
      let parent = btn.parent()
      for (let i = 0; i < 3 && parent; i++) {
        try {
          const children = parent.children()
          if (children) {
            for (const child of children) {
              try { const t = child.text(); if (t) texts.push(t) } catch (e) { /* ignore */ }
              try { const d = child.desc(); if (d) texts.push(d) } catch (e) { /* ignore */ }
            }
          }
        } catch (e) { /* ignore */ }
        try { parent = parent.parent() } catch (e) { break }
      }
    } catch (e) { /* ignore */ }
    return texts
  }

  // ============================================================
  // 关闭观众列表 + 切直播间
  // ============================================================
  function closeViewerList() {
    try {
      if (desc('关闭').visibleToUser().exists()) {
        clickContent('关闭', 'desc')
      } else if (textContains('关闭').visibleToUser().exists()) {
        clickContent('关闭', 'text')
      } else {
        back()
      }
      sleep(1000)
      if (isViewerListOpen()) {
        back()
        sleep(500)
      }
    } catch (e) {
      try { back() } catch (e2) { /* ignore */ }
    }
    sleep(500)
  }

  function swipeToNext() {
    toastLog('切换到下一个直播间')
    sleep(1500)
    liveSwipe()
    sleep(2000)
  }

  // ============================================================
  // 工具
  // ============================================================
  function rand(min, max) {
    return Math.round(Math.random() * (max - min) + min)
  }

  // ============================================================
  // 导出
  // ============================================================
  module.exports = main
})()
