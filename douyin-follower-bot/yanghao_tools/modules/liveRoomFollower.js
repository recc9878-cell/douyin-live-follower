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

    // 开始主循环
    toastLog('开始刷直播间...')
    mainLoop()
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

  function mainLoop() {
    try {
      // 检查上限
      if (hitLimits()) return

      if (isInLiveRoom()) {
        toastLog('发现直播间，进入')
        doLiveRoomFollow()
      } else {
        // 不在直播间 → 滑动找直播间
        randomSleep(2000, 4000)
        randomSwipe()
        randomSleep(2000, 4000)
        mainLoop()
      }
    } catch (e) {
      log('主循环异常: ' + e)
      randomSleep(3000)
      mainLoop()
    }
  }

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
    // 多种判断方式，任一成立即认为在直播间
    return desc('点击进入直播间按钮').exists() ||
           text('更多直播').exists() ||
           id('com.ss.android.ugc.aweme:id/p25').exists()
  }

  // ============================================================
  // 直播间关注全流程
  // ============================================================
  function doLiveRoomFollow() {
    // 1. 点进直播间（如果在推荐流上还没进去）
    if (!text('更多直播').exists()) {
      clickContent('点击进入直播间按钮', 'desc')
      // 等直播间加载
      for (let i = 0; i < 15; i++) {
        if (text('更多直播').exists() || id('com.ss.android.ugc.aweme:id/p25').exists()) break
        sleep(1000)
      }
    }

    // 确认是否成功进入
    if (!text('更多直播').exists() && !id('com.ss.android.ugc.aweme:id/p25').exists()) {
      toastLog('进入直播间失败，跳过')
      nextLiveRoom()
      return
    }
    toastLog('已进入直播间')

    // 2. 打开在线观众列表
    if (!openViewerList()) {
      toastLog('打不开观众列表，切下一个')
      nextLiveRoom()
      return
    }

    // 3. 处理观众列表 → 关注男性用户
    const followed = processViewerList()

    // 4. 关闭观众列表
    closeViewerList()

    toastLog('本直播间关注了 ' + followed + ' 人')
    sessionCount += followed

    // 5. 滑到下一个直播间
    nextLiveRoom()
    mainLoop()
  }

  // ============================================================
  // 打开观众列表
  // ============================================================
  function openViewerList() {
    toastLog('打开观众列表...')

    // 策略1：点击"xx人正在看"这类文本
    const viewerTexts = textMatches(/[0-9.]+万?人?正在看/)
    if (viewerTexts.exists()) {
      toastLog('点击人数区域')
      try {
        // 取最后一个（通常是人数显示的主要控件）
        const els = viewerTexts.find()
        if (els.length > 0) {
          const btn = els[els.length - 1]
          anti.randomTap(btn)
          sleep(2000)
          if (isViewerListOpen()) return true
        }
      } catch (e) { log('点击人数区域失败') }
    }

    // 策略2：点击直播间人数 id
    try {
      const personId = id('com.ss.android.ugc.aweme:id/p25')
      if (personId.exists()) {
        anti.randomTap(personId.findOnce())
        sleep(2000)
        if (isViewerListOpen()) return true
      }
    } catch (e) { log('id方法失败') }

    // 策略3：直播间底部中间区域坐标点击（观众入口通常在底部中间偏右）
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
    // 观众列表打开后通常会出现 RecyclerView + 有关闭按钮
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

    toastLog('开始处理观众列表')

    while (scrollCount < maxScrolls) {
      // 检查上限
      if (hitLimits()) break

      // 找到当前可见的所有"关注"按钮
      const followBtns = findFollowButtonsInList()
      log('找到 ' + followBtns.length + ' 个关注按钮')

      // 遍历关注按钮
      let processedThisScroll = false
      for (const btn of followBtns) {
        if (hitLimits()) break
        if (!btn || !btn.visibleToUser()) continue

        try {
          // 检查性别（如果启用了男性筛选）
          if (config.followMaleOnly() && !isMaleNearButton(btn)) {
            log('跳过：非男性或无法判断')
            continue
          }

          // 概率关注
          if (!anti.chance(config.followProbability())) {
            log('概率跳过')
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
          log('关注按钮点击异常: ' + e)
          continue
        }
      }

      // 如果当前页没有新关注，可能需要滚动
      if (!processedThisScroll) {
        toastLog('滚动列表...')
        anti.scrollDown()
        sleep(config.scrollDelayMin() + random(0, config.scrollDelayMax() - config.scrollDelayMin()))
        scrollCount++
      }
    }

    return followed
  }

  // ============================================================
  // 查找观众列表中的"关注"按钮
  // ============================================================
  function findFollowButtonsInList() {
    const btns = []

    // 方法1（推荐）：className + desc 精确匹配
    // 这是社区验证的最稳定方案
    try {
      const followEls = className('android.widget.Button').desc('关注').find()
      for (const el of followEls) {
        if (el && el.visibleToUser()) {
          // 确保这个按钮在观众列表面板内
          if (isInsideViewerList(el)) {
            btns.push(el)
          }
        }
      }
      if (btns.length > 0) return btns
    } catch (e) { log('方法1异常: ' + e) }

    // 方法2：直接 text("关注") 查找（备选）
    try {
      const textEls = text('关注').find()
      for (const el of textEls) {
        if (el && el.visibleToUser() && isInsideViewerList(el)) {
          // 优先用可点击的父容器
          try {
            const parent = el.parent()
            if (parent && parent.clickable()) btns.push(parent)
            else btns.push(el)
          } catch (e) {
            btns.push(el)
          }
        }
      }
      if (btns.length > 0) return btns
    } catch (e) { log('方法2异常: ' + e) }

    return btns
  }

  /** 判断控件是否在观众列表面板内 */
  function isInsideViewerList(el) {
    try {
      // 观众列表通常以 RecyclerView 为容器
      if (className('androidx.recyclerview.widget.RecyclerView').exists()) {
        const listView = className('androidx.recyclerview.widget.RecyclerView').findOnce()
        if (listView) {
          const listBounds = listView.bounds()
          const elBounds = el.bounds()
          if (listBounds && elBounds) {
            return elBounds.top >= listBounds.top &&
                   elBounds.bottom <= listBounds.bottom
          }
        }
      }
    } catch (e) { /* 无法判断时假定在列表内 */ }
    return true
  }

  // ============================================================
  // 性别判断（简化版）
  // ============================================================
  function isMaleNearButton(btn) {
    try {
      const btnBounds = btn.bounds()
      if (!btnBounds) return true

      // 在按钮附近区域扫描性别标识
      // 抖音观众列表项中，性别通常在关注按钮左侧的头像/昵称区域
      const scanLeft = btnBounds.left - 300
      const scanRight = btnBounds.right
      const scanTop = btnBounds.top - 20
      const scanBottom = btnBounds.bottom + 20

      // 在这个区域内查找"男"或"女"文字
      const maleEl = text('男').findOnce(100)
      const femaleEl = text('女').findOnce(100)

      if (maleEl) {
        try {
          const mBounds = maleEl.bounds()
          if (mBounds && mBounds.left >= scanLeft && mBounds.right <= scanRight &&
              mBounds.top >= scanTop && mBounds.bottom <= scanBottom) {
            return true
          }
        } catch (e) { /* ignore */ }
      }

      if (femaleEl) {
        try {
          const fBounds = femaleEl.bounds()
          if (fBounds && fBounds.left >= scanLeft && fBounds.right <= scanRight &&
              fBounds.top >= scanTop && fBounds.bottom <= scanBottom) {
            return false
          }
        } catch (e) { /* ignore */ }
      }

      // 扫描按钮的父级和兄弟级控件
      try {
        const texts = collectAllTextNear(btn)
        for (const t of texts) {
          if (t === '男') return true
          if (t === '女') return false
        }
      } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }

    // 无法判断时默认为男性（宁可不漏）
    return true
  }

  /** 收集按钮附近的文字 */
  function collectAllTextNear(btn) {
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
      // 没关掉就再按一次返回
      if (isViewerListOpen()) back()
    } catch (e) {
      try { back() } catch (e2) { /* ignore */ }
    }
    sleep(500)
  }

  function nextLiveRoom() {
    toastLog('切换到下一个直播间')
    sleep(1500)
    liveSwipe()
    sleep(2000)
  }

  // ============================================================
  // 工具
  // ============================================================
  function random(min, max) {
    return Math.round(Math.random() * (max - min) + min)
  }

  // ============================================================
  // 导出
  // ============================================================
  module.exports = main
})()
