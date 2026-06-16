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
    // dayjs 是 AutoJs6 全局内置，直接使用
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

  /**
   * 真正的抖音操作流程：
   *
   * 观众列表 → 点头像 → 弹窗显示性别 → 点关注 → 关弹窗
   *
   * 不直接在列表里找关注按钮，因为关注按钮在头像的弹窗里。
   */
  function processViewerList() {
    const maxScrolls = config.maxScrollsPerRoom()
    let followed = 0
    let scrollCount = 0
    let emptyCount = 0

    toastLog('开始处理观众列表 — 点头像→看性别→关注')

    while (scrollCount < maxScrolls) {
      if (hitLimits()) break

      // 获取当前可见的观众头像
      const avatarItems = getViewerAvatarItems()
      log('找到 ' + avatarItems.length + ' 个头像')

      if (avatarItems.length === 0) {
        emptyCount++
        if (emptyCount >= 2) {
          toastLog('没有更多观众')
          break
        }
      } else {
        emptyCount = 0
      }

      // 遍历每个观众 → 点头像 → 弹窗判断性别 → 关注
      let processed = false
      for (const avatar of avatarItems) {
        if (hitLimits()) break
        if (!avatar || !avatar.visibleToUser()) continue

        try {
          // 点头像 → 弹出个人资料
          toastLog('点击观众头像')
          anti.randomTap(avatar, config.tapOffsetMin(), config.tapOffsetMax())

          // 等弹窗出现
          const popupOpened = waitForProfilePopup()
          if (!popupOpened) {
            log('弹窗未出现，下一个')
            continue
          }

          // 查看性别
          if (config.followMaleOnly()) {
            if (!isMaleInPopup()) {
              toastLog('非男性，跳过')
              closeProfilePopup()
              anti.randomDelay(1500, 3000)
              continue
            }
          }

          // 概率关注
          if (!anti.chance(config.followProbability())) {
            toastLog('概率跳过')
            closeProfilePopup()
            anti.randomDelay(1500, 3000)
            continue
          }

          // 在弹窗中点关注
          const followedOk = clickFollowInPopup()
          if (followedOk) {
            followed++
            config.incrementDayFollowed()
            processed = true
            toastLog('已关注 ✓ (' + config.dayFollowedAmount() + '/' + config.dayFollowLimit() + ')')
          } else {
            toastLog('未找到关注按钮')
          }

          // 关弹窗
          closeProfilePopup()

          // 随机延时
          anti.randomDelay(config.followMinDelay(), config.followMaxDelay())
        } catch (e) {
          log('处理单个观众异常: ' + e)
          // 出错时尝试关弹窗，继续下一个
          try { closeProfilePopup() } catch (e2) { /* ignore */ }
          anti.randomDelay(1500, 3000)
        }
      }

      // 滚动列表
      if (!processed) {
        scrollCount++
        if (scrollCount < maxScrolls) {
          toastLog('滚动列表 (' + scrollCount + '/' + maxScrolls + ')')
          anti.scrollDown()
        }
      } else {
        // 有操作成功，但列表可能还有更多，也可以考虑滚动
        if (scrollCount < maxScrolls) {
          anti.scrollDown()
          scrollCount++
        }
      }
    }

    return followed
  }

  // ============================================================
  // 观众头像获取
  // ============================================================

  /**
   * 获取观众列表中当前可见的所有头像控件
   *
   * 观众列表是一个 RecyclerView，每一项包含头像、昵称等。
   * 头像通常是 ImageView，并且是列表项中可点击的圆形控件。
   */
  function getViewerAvatarItems() {
    const items = []

    // 方法1：从 RecyclerView 中找 ImageView（头像）
    try {
      if (className('androidx.recyclerview.widget.RecyclerView').exists()) {
        const listView = className('androidx.recyclerview.widget.RecyclerView').findOnce()
        if (listView) {
          const children = listView.children()
          if (children && children.length > 0) {
            for (const child of children) {
              if (child && child.visibleToUser()) {
                // 用 ImageView 作为头像候选
                const imageViews = child.find(className('android.widget.ImageView'))
                if (imageViews && imageViews.length > 0) {
                  // 第一个 ImageView 通常是头像
                  items.push(imageViews[0])
                } else {
                  // 没有找到 ImageView → 用整个列表项
                  items.push(child)
                }
              }
            }
            if (items.length > 0) {
              log('从 RecyclerView 获取到 ' + items.length + ' 个头像')
              return items
            }
          }
        }
      }
    } catch (e) { log('RecyclerView 获取失败: ' + e) }

    // 方法2：直接找可见的 ImageView（限制在屏幕中下区域，排除顶部）
    try {
      // 观众列表在屏幕下半部分（直播间上半部分是视频）
      const centerY = device.height * 0.5
      const imageViews = className('android.widget.ImageView').find()
      for (const iv of imageViews) {
        try {
          const b = iv.bounds()
          if (b && b.top > centerY && iv.visibleToUser()) {
            // 圆形头像通常宽高比接近 1:1
            const ratio = Math.abs(b.right - b.left) / Math.max(Math.abs(b.bottom - b.top), 1)
            if (ratio > 0.7 && ratio < 1.4) {
              items.push(iv)
            }
          }
        } catch (e2) { /* ignore */ }
      }
      if (items.length > 0) {
        log('通过 ImageView 遍历获取到 ' + items.length + ' 个头像')
        return items
      }
    } catch (e) { log('ImageView 遍历失败: ' + e) }

    // 方法3：兜底 — 用所有可点击的控件列表项
    try {
      if (className('androidx.recyclerview.widget.RecyclerView').exists()) {
        const listView = className('androidx.recyclerview.widget.RecyclerView').findOnce()
        if (listView) {
          const children = listView.children()
          if (children) {
            for (const child of children) {
              if (child && child.visibleToUser()) {
                items.push(child)
              }
            }
          }
        }
      }
    } catch (e) { /* ignore */ }

    log('最终获取到 ' + items.length + ' 个观众项')
    return items
  }

  // ============================================================
  // 弹窗操作
  // ============================================================

  /**
   * 等待个人资料弹窗出现
   * 点击头像后，抖音会弹出一个覆盖层显示用户信息
   */
  function waitForProfilePopup() {
    // 弹窗出现后，通常会有"关注"按钮、"私信"按钮等
    for (let i = 0; i < 10; i++) {
      if (isProfilePopupVisible()) {
        log('个人资料弹窗已出现')
        // 等弹窗完全加载
        sleep(1000)
        return true
      }
      sleep(500)
    }
    log('个人资料弹窗超时')
    return false
  }

  /** 判断个人资料弹窗是否可见 */
  function isProfilePopupVisible() {
    return desc('关注').visibleToUser().exists() ||
           desc('私信').visibleToUser().exists() ||
           text('关注').visibleToUser().exists()
  }

  /**
   * 在弹窗中判断性别
   *
   * 抖音的性别显示方式：
   * 1. 文字直接显示：头像下方有"男"或"女"文字
   * 2. 性别图标：一个带颜色的小图标（蓝色=男，粉色=女），通过 desc 或 className 判断
   * 3. 不显示：有些用户没设性别
   *
   * @returns {boolean|null} true=男, false=女, null=未知（不显示）
   */
  function isMaleInPopup() {
    // 方法1：直接找"男"或"女"文字
    try {
      if (text('男').visibleToUser().exists()) {
        log('性别判断：男（文字匹配）')
        return true
      }
      if (text('女').visibleToUser().exists()) {
        log('性别判断：女（文字匹配）')
        return false
      }
    } catch (e) { /* ignore */ }

    // 方法2：找性别图标的 desc
    // 有些版本用蓝色/粉色图标表示性别，desc 可能是"男"或"女"
    try {
      const genderIcons = className('android.widget.ImageView').descMatches(/男|女/).find()
      if (genderIcons && genderIcons.length > 0) {
        const desc = genderIcons[0].desc()
        log('性别判断：' + desc + '（图标 desc）')
        return desc === '男'
      }
    } catch (e) { /* ignore */ }

    // 方法3：扫描弹窗范围内的所有文字
    try {
      const allText = className('android.widget.TextView').find()
      for (const tv of allText) {
        if (!tv.visibleToUser()) continue
        try {
          const t = tv.text()
          if (t === '男') { log('性别判断：男（TextViews）'); return true }
          if (t === '女') { log('性别判断：女（TextViews）'); return false }
        } catch (e2) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }

    // 方法4：检查弹窗中的信息区域
    // 有些版本性别显示在用户资料区域，可能是一个小标签
    try {
      if (textContains('岁').visibleToUser().exists()) {
        // 有年龄但没有性别 → 可能性别不显示
        log('性别判断：未显示（有年龄无性别）')
        return null
      }
    } catch (e) { /* ignore */ }

    log('性别判断：未显示')
    return null
  }

  /**
   * 在弹窗中点击"关注"按钮
   *
   * @returns {boolean} 是否成功
   */
  function clickFollowInPopup() {
    // 策略1：desc("关注")
    try {
      if (desc('关注').visibleToUser().exists()) {
        const btn = desc('关注').findOnce(1000)
        if (btn) {
          anti.randomTap(btn, config.tapOffsetMin(), config.tapOffsetMax())
          log('点击关注成功（desc）')
          sleep(500)
          return true
        }
      }
    } catch (e) { log('desc关注失败: ' + e) }

    // 策略2：text("关注")
    try {
      if (text('关注').visibleToUser().exists()) {
        const btn = text('关注').findOnce(1000)
        if (btn) {
          // 优先点可点击的父容器
          try {
            const parent = btn.parent()
            if (parent && parent.clickable()) {
              anti.randomTap(parent, config.tapOffsetMin(), config.tapOffsetMax())
            } else {
              anti.randomTap(btn, config.tapOffsetMin(), config.tapOffsetMax())
            }
          } catch (e) {
            anti.randomTap(btn, config.tapOffsetMin(), config.tapOffsetMax())
          }
          log('点击关注成功（text）')
          sleep(500)
          return true
        }
      }
    } catch (e) { log('text关注失败: ' + e) }

    // 策略3：className("android.widget.Button") + desc("关注")
    try {
      const btn = className('android.widget.Button').desc('关注').findOnce(500)
      if (btn && btn.visibleToUser()) {
        anti.randomTap(btn, config.tapOffsetMin(), config.tapOffsetMax())
        log('点击关注成功（className+desc）')
        sleep(500)
        return true
      }
    } catch (e) { /* ignore */ }

    return false
  }

  /**
   * 关闭个人资料弹窗
   *
   * 弹窗通常点击背景区域或按返回键关闭
   */
  function closeProfilePopup() {
    if (!isProfilePopupVisible()) {
      log('弹窗已关闭，无需操作')
      return
    }

    // 策略1：点击弹窗空白区域（弹窗背景通常是半透明的，外圈可点击）
    try {
      // 点击屏幕左上角（弹窗外部区域）
      press(device.width * 0.05, device.height * 0.1, 50)
      sleep(500)
      if (!isProfilePopupVisible()) {
        log('关闭弹窗成功（点击外部）')
        return
      }
    } catch (e) { /* ignore */ }

    // 策略2：按返回键
    try {
      back()
      sleep(500)
      if (!isProfilePopupVisible()) {
        log('关闭弹窗成功（返回键）')
        return
      }
    } catch (e) { /* ignore */ }

    // 策略3：再按一次返回
    try {
      back()
      sleep(300)
    } catch (e) { /* ignore */ }
  }

  // ============================================================
  // 性别筛选（列表级 — 备选方案）
  // ============================================================

  /**
   * 尝试在观众列表中使用筛选功能
   *
   * 部分抖音版本的观众列表顶部有"全部/男/女"Tab，
   * 如果有就直接选"男"，后续就不用逐个判断性别了。
   */
  function filterMaleUsers() {
    toastLog('尝试列表级性别筛选...')

    // 策略：找"全部/男/女"Tab
    try {
      // 看点"男"是否可见
      if (text('男').visibleToUser().exists()) {
        const maleTab = text('男').findOnce(500)
        if (maleTab) {
          anti.randomTap(maleTab)
          sleep(1500)
          toastLog('✅ 列表筛选：只看男性')
          return
        }
      }
      // "男"不可见，看看有没有"全部"，点了展开找"男"
      if (text('全部').visibleToUser().exists()) {
        const allTab = text('全部').findOnce(500)
        if (allTab) {
          anti.randomTap(allTab)
          sleep(1000)
          if (text('男').visibleToUser().exists()) {
            anti.randomTap(text('男').findOnce(500))
            sleep(1500)
            toastLog('✅ 列表筛选：只看男性')
            return
          }
        }
      }
    } catch (e) { log('筛选Tab失败: ' + e) }

    // 没有筛选功能 → 后续靠点头像进弹窗逐个判断
    toastLog('列表无筛选，将逐个点头像看性别')
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
