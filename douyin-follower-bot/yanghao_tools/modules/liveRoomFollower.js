/**
 * 直播间自动关注 — 核心执行模块
 *
 * 职责：实现完整的「打开观众列表 → 筛选男性 → 逐个关注 → 切直播间」流程
 *
 * 设计原则：
 * 1. 选择器优先用 id，后备用 text/desc，最后用坐标 — 适配不同抖音版本
 * 2. 所有操作带随机延时和随机偏移 — 防检测
 * 3. 所有可能异常都有 try-catch — 不会单次失败就崩溃
 * 4. 与原项目共用基础设施（弹窗拦截、随机滑动等）
 *
 * 依赖：
 *   - utils/antiDetection.js    增强反检测函数
 *   - utils/widget.js           控件选择器
 *   - utils/util.js             基础工具函数（randomSleep, randomSwipe, liveSwipe 等）
 *   - utils/douyinClosePopup.js 弹窗拦截
 *   - utils/openApp.js          打开 APP
 *   - config/followerConfig.js   配置存储
 *
 * 运行方式：
 *   const startLiveRoomFollower = require('./modules/liveRoomFollower')
 *   startLiveRoomFollower()
 */

(() => {
  // ============================================================
  // 依赖引入
  // ============================================================
  const openApp = require('../utils/openApp')
  const { toIndexPage, videoLikeCommentCollect } = require('../utils/douyinUtils')
  const { randomRun, randomSwipe, randomSleep, liveSwipe, clickContent } = require('../utils/util')
  const douyinClosePopup = require('../utils/douyinClosePopup')
  const followerConfig = require('../config/followerConfig')
  const anti = require('../utils/antiDetection')

  const {
    liveViewerListButton, liveViewerListPanel, liveViewerListItem,
    liveViewerItemName, liveViewerGenderIcon, liveViewerFollowBtn,
    liveViewerFilterBtn, liveViewerFilterMale, liveViewerFilterConfirm,
    liveViewerClose,
    liveClose, livePersonAmountWidget,
  } = require('../utils/widget')

  // ============================================================
  // 模块入口
  // ============================================================

  /**
   * 主入口 — 启动抖音 → 开始任务循环
   *
   * 调用方式：
   *   const start = require('./modules/liveRoomFollower')
   *   start()
   */
  function main() {
    toastLog('===== 直播间自动关注脚本启动 =====')

    // 每日重置检查
    checkDailyReset()

    // 打开抖音 App
    openApp('抖音')

    // 启动弹窗拦截线程（后台持续运行）
    douyinClosePopup()
    randomSleep(2000)

    // 切换到首页推荐页
    toastLog('切换到首页推荐')
    toIndexPage()
    toastLog('等待页面加载完成')
    randomSleep(5000)

    // 开始主任务循环
    toastLog('开始主任务循环')
    startMissionLoop()
  }

  // ============================================================
  // 每日重置
  // ============================================================

  /**
   * 检查是否需要重置当日关注计数
   * 如果是新的一天，重置计数和限流
   */
  function checkDailyReset() {
    const dayjs = require('../utils/dayjs.1.11.6.min')
    const today = dayjs(new Date().getTime()).format('YYYY-MM-DD')
    const lastRun = dayjs(followerConfig.lastRunTime()).format('YYYY-MM-DD')

    if (today !== lastRun) {
      followerConfig.resetDayFollowed()
      toastLog('新的一天，已重置关注计数')
    }
  }

  // ============================================================
  // 主任务循环
  // ============================================================

  /** 当前循环执行的总关注数（单次执行） */
  let sessionFollowedCount = 0
  /** 当前是否已进入关注流程（防止重复进入） */
  let isInFollowProcess = false

  /**
   * 主循环 — 不断判断是否在直播间，是则执行关注，否则刷视频寻找直播间
   */
  function startMissionLoop() {
    try {
      // 先检查单次关注上限
      if (sessionFollowedCount >= followerConfig.sessionFollowLimit()) {
        toastLog('已达到本次执行关注上限（' + sessionFollowedCount + '/' + followerConfig.sessionFollowLimit() + '），停止任务')
        toastLog('如需继续执行，请重新运行脚本')
        return
      }

      // 检查当日关注上限
      if (followerConfig.dayFollowedAmount() >= followerConfig.dayFollowLimit()) {
        toastLog('已达到当日关注上限（' + followerConfig.dayFollowedAmount() + '/' + followerConfig.dayFollowLimit() + '），停止任务')
        toastLog('明天再运行吧')
        return
      }

      // 判断是否在直播间界面
      if (isInLiveRoom()) {
        log('检测到直播间，进入关注流程')
        enterLiveRoomAndFollow()
      } else {
        // 不在直播间，滑动刷视频
        log('不在直播间，继续刷视频')
        randomSleep(3000, 5000)
        randomSwipe()
        randomSleep(1500, 3000)
        // 递归检查
        startMissionLoop()
      }
    } catch (error) {
      log('【Error】startMissionLoop 异常：' + error)
      randomSleep(3000)
      startMissionLoop()
    }
  }

  /**
   * 判断当前是否在直播间
   *
   * 原项目 isLive() 通过检查"点击进入直播间按钮"的 desc 来判断。
   * 这里使用更通用的方式：
   * 1. 检查直播间人数控件
   * 2. 检查"更多直播"文字
   * 3. 检查特定的 desc
   *
   * @returns {boolean}
   */
  function isInLiveRoom() {
    try {
      // 方法1：检测直播间的特定元素
      if (desc("点击进入直播间按钮").visibleToUser().exists()) {
        return true
      }
      // 方法2：检测直播间人数显示
      if (id(livePersonAmountWidget).visibleToUser().exists()) {
        return true
      }
      // 方法3：检测"更多直播"文字（出现在直播间右上角）
      if (text("更多直播").visibleToUser().exists()) {
        return true
      }
      // 方法4：检测直播间用户评论区域（直播间特有的"xxx：xxx"评论格式）
      if (id('com.ss.android.ugc.aweme:id/text').visibleToUser().exists()) {
        // 需要排除非直播场景，用直播间人数控件二次确认
        if (id(livePersonAmountWidget).exists()) {
          return true
        }
      }
      return false
    } catch (e) {
      return false
    }
  }

  // ============================================================
  // 直播间关注流程
  // ============================================================

  /**
   * 进入直播间并执行关注流程
   *
   * 步骤：
   * 1. 点击进入直播间（如果还没进去）
   * 2. 等待直播间加载
   * 3. 打开在线观众列表
   * 4. 等待列表加载
   * 5. 筛选男性用户
   * 6. 循环处理观众列表
   * 7. 关闭列表
   * 8. 滑动到下一个直播间
   */
  function enterLiveRoomAndFollow() {
    if (isInFollowProcess) {
      log('已在关注流程中，跳过重复进入')
      return
    }
    isInFollowProcess = true

    try {
      // ---- 步骤1：点击进入直播间 ----
      if (!isAlreadyInLive()) {
        toastLog('点击进入直播间')
        clickContent('点击进入直播间按钮', 'desc')
        // 等待直播间完全加载
        anti.humanLikeDelay(3000, 5000)
      }

      // 判断是否真的进入了直播间
      if (!text("更多直播").findOne(8000) && !id(livePersonAmountWidget).findOne(5000)) {
        toastLog('进入直播间失败，跳过')
        isInFollowProcess = false
        startMissionLoop()
        return
      }

      toastLog('已进入直播间')

      // ---- 步骤2：打开在线观众列表 ----
      const listOpened = openViewerList()
      if (!listOpened) {
        toastLog('打开观众列表失败，切换直播间')
        isInFollowProcess = false
        swipeToNextLive()
        return
      }

      // ---- 步骤3：等待列表加载 ----
      const loaded = waitForViewerListLoaded()
      if (!loaded) {
        toastLog('观众列表加载超时，切换直播间')
        closeViewerList()
        isInFollowProcess = false
        swipeToNextLive()
        return
      }

      // ---- 步骤4：筛选男性用户（如果列表有此功能） ----
      filterMaleUsers()

      // ---- 步骤5：循环处理观众列表 ----
      const followedCount = processViewerList()

      toastLog('本直播间共关注了 ' + followedCount + ' 人')

      // ---- 步骤6：关闭观众列表 ----
      closeViewerList()
      actionPause(1000, 2000)

      // ---- 步骤7：滑到下一个直播间 ----
      isInFollowProcess = false
      swipeToNextLive()

      // ---- 步骤8：继续循环 ----
      startMissionLoop()
    } catch (error) {
      log('【Error】enterLiveRoomAndFollow 异常：' + error)
      // 出错时尝试复原
      try { closeViewerList() } catch (e) { /* ignore */ }
      try { back() } catch (e) { /* ignore */ }
      isInFollowProcess = false
      randomSleep(3000)
      startMissionLoop()
    }
  }

  /**
   * 判断是否已经在直播间内（不是首页推荐流上的直播间封面）
   */
  function isAlreadyInLive() {
    return text("更多直播").exists() || id(livePersonAmountWidget).exists()
  }

  // ============================================================
  // 观众列表操作
  // ============================================================

  /**
   * 打开在线观众列表
   *
   * 使用多种策略定位"在线观众"按钮：
   * 策略1：通过 liveViewerListButton 的 ID
   * 策略2：通过文本匹配"xx人正在看"或"在线观众"
   * 策略3：通过 desc 描述匹配
   * 策略4：扫描直播间底部区域的交互按钮
   *
   * @returns {boolean} 是否成功打开
   */
  function openViewerList() {
    toastLog('正在打开在线观众列表')
    log('【openViewerList】尝试打开观众列表')

    try {
      // ---- 策略1：通过控件 ID ----
      if (id(liveViewerListButton).exists()) {
        const btn = id(liveViewerListButton).findOne(3000)
        if (btn && btn.visibleToUser()) {
          log('【openViewerList】通过 ID 找到观众列表按钮')
          anti.randomTapOnButton(btn, 5, 20)
          anti.humanLikeDelay(2000, 3500)
          // 验证是否打开成功
          if (isViewerListVisible()) {
            toastLog('观众列表已打开（ID 定位）')
            return true
          }
        }
      }

      // ---- 策略2：通过 desc 或文本匹配直播间用户入口 ----
      // 抖音常见描述：在线观众、观众列表、xx人在看
      const descPatterns = [
        '在线观众', '观众列表', '在线列表',
        '查看观众', '更多观众',
      ]
      for (let i = 0; i < descPatterns.length; i++) {
        try {
          if (desc(descPatterns[i]).exists()) {
            const el = desc(descPatterns[i]).findOne(2000)
            if (el && el.visibleToUser()) {
              log('【openViewerList】通过 desc "' + descPatterns[i] + '" 找到按钮')
              anti.randomTapOnButton(el, 5, 20)
              anti.humanLikeDelay(2000, 3500)
              if (isViewerListVisible()) {
                toastLog('观众列表已打开（desc 定位）')
                return true
              }
            }
          }
        } catch (e) { /* 单个模式失败继续下一个 */ }
      }

      // ---- 策略3：匹配"xx人正在看"格式的文本 ----
      // 直播间底部通常显示"1.2万人正在看"
      try {
        const liveCountEls = textMatches(/[0-9.]+万?人正在看/).find()
        for (let i = 0; i < liveCountEls.length; i++) {
          const el = liveCountEls[i]
          if (el && el.visibleToUser()) {
            log('【openViewerList】通过人数文本匹配：' + el.text())
            anti.randomTapOnButton(el, 5, 20)
            anti.humanLikeDelay(2000, 3500)
            if (isViewerListVisible()) {
              toastLog('观众列表已打开（人数文本匹配）')
              return true
            }
          }
        }
      } catch (e) { /* ignore */ }

      // ---- 策略4：通过坐标定位（最后手段） ----
      // 通常在线观众按钮在直播间底部中间偏右区域
      toastLog('尝试通过坐标点击观众入口（最后手段）')
      const width = device.width
      const height = device.height
      // 底部区域：距离底部 80-200px 范围内，水平居中偏右
      const regionLeft = Math.round(width * 0.2)
      const regionRight = Math.round(width * 0.8)
      const regionTop = Math.round(height - 250)
      const regionBottom = Math.round(height - 60)

      // 在这个区域内分多个点尝试点击
      const attempts = [
        { x: Math.round(width * 0.5), y: Math.round(height - 150) }, // 底部中央
        { x: Math.round(width * 0.6), y: Math.round(height - 130) }, // 底部偏右
        { x: Math.round(width * 0.4), y: Math.round(height - 170) }, // 底部偏左
        { x: Math.round(width * 0.55), y: Math.round(height - 100) }, // 底部偏下
      ]

      for (let i = 0; i < attempts.length; i++) {
        const pt = attempts[i]
        if (pt.x >= regionLeft && pt.x <= regionRight &&
            pt.y >= regionTop && pt.y <= regionBottom) {
          log('【openViewerList】尝试坐标点击：(' + pt.x + ', ' + pt.y + ')')
          press(pt.x, pt.y, anti.pressHoldDuration())
          sleep(randomInRange(1500, 2500))
          if (isViewerListVisible()) {
            toastLog('观众列表已打开（坐标定位）')
            return true
          }
        }
      }

      toastLog('无法定位观众列表按钮')
      return false
    } catch (error) {
      log('【Error】openViewerList 异常：' + error)
      return false
    }
  }

  /**
   * 判断观众列表是否已打开
   *
   * 通过检测列表面板相关的 UI 元素判断
   */
  function isViewerListVisible() {
    try {
      // 方法1：检测列表面板控件
      if (id(liveViewerListPanel).visibleToUser().exists()) {
        return true
      }
      // 方法2：检测列表项
      if (id(liveViewerListItem).visibleToUser().exists()) {
        return true
      }
      // 方法3：检测常见的观众列表标题文字
      if (text('在线观众').exists() || text('观众列表').exists() || desc('关闭').exists()) {
        // 在直播场景下有关闭按钮且在前面检测到的内容之上
        return true
      }
      // 方法4：检测观众列表特有的 UI 结构（ListView 或 RecyclerView）
      if (className('androidx.recyclerview.widget.RecyclerView').visibleToUser().exists() ||
          className('android.widget.ListView').visibleToUser().exists()) {
        // 双重确认：同时有"在线观众"文字
        if (textContains('在线').exists() || textContains('观众').exists()) {
          return true
        }
      }
      return false
    } catch (e) {
      return false
    }
  }

  /**
   * 等待观众列表完全加载
   *
   * @param {number} timeout 超时时间（ms）
   * @returns {boolean} 是否加载成功
   */
  function waitForViewerListLoaded(timeout) {
    toastLog('等待观众列表加载')
    timeout = timeout || 5000
    const startTime = new Date().getTime()

    while (new Date().getTime() - startTime < timeout) {
      // 检查列表项是否出现
      if (id(liveViewerListItem).visibleToUser().exists()) {
        log('【waitForViewerListLoaded】列表项已加载')
        anti.humanLikeDelay(1000, 2000)
        return true
      }

      // 检查 RecyclerView（通用列表容器）
      if (className('androidx.recyclerview.widget.RecyclerView').visibleToUser().exists()) {
        // 等待列表内容渲染
        sleep(1500)
        return true
      }

      sleep(500)
    }

    log('【waitForViewerListLoaded】超时')
    return false
  }

  // ============================================================
  // 性别筛选
  // ============================================================

  /**
   * 筛选男性用户
   *
   * 如果观众列表有性别筛选功能则使用，否则跳过（在循环中逐个判断）
   */
  function filterMaleUsers() {
    if (!followerConfig.followMaleOnly()) {
      log('【filterMaleUsers】未启用性别筛选，处理所有用户')
      return
    }

    toastLog('尝试筛选男性用户')
    log('【filterMaleUsers】开始筛选男性')

    try {
      // ---- 策略1：通过筛选按钮 ----
      const filterFound = findAndClickFilter()
      if (filterFound) {
        log('【filterMaleUsers】已点击筛选按钮，等待性别选项')
        anti.humanLikeDelay(1500, 2500)

        // 点击男性选项
        if (id(liveViewerFilterMale).exists()) {
          const maleOpt = id(liveViewerFilterMale).findOne(2000)
          if (maleOpt) {
            anti.randomTapOnButton(maleOpt)
            log('【filterMaleUsers】已选择男性')
            anti.actionPause()

            // 点击确认按钮
            if (id(liveViewerFilterConfirm).exists()) {
              anti.randomTapOnButton(id(liveViewerFilterConfirm).findOne(2000))
            } else if (text('确定').exists()) {
              clickContent('确定', 'text')
            } else if (desc('完成').exists()) {
              clickContent('完成', 'desc')
            }

            anti.humanLikeDelay(1500, 2500)
            toastLog('筛选条件已设置：男性')
            return
          }
        }

        // 如果筛选面板上有文字选项（如 radio button 形式的男女选择）
        try {
          const maleTextBtn = text('男').findOne(2000)
          if (maleTextBtn && maleTextBtn.visibleToUser()) {
            anti.randomTapOnButton(maleTextBtn)
            anti.actionPause()
            // 确认
            if (text('确定').exists()) clickContent('确定', 'text')
            else if (desc('完成').exists()) clickContent('完成', 'desc')
            anti.humanLikeDelay(1500, 2500)
            toastLog('筛选条件已设置：男性（文本匹配）')
            return
          }
        } catch (e) { /* ignore */ }
      }

      log('【filterMaleUsers】未找到筛选功能，将在循环中逐个判断性别')
    } catch (error) {
      log('【Error】filterMaleUsers 异常：' + error)
    }
  }

  /**
   * 查找并点击筛选按钮
   */
  function findAndClickFilter() {
    // 通过 ID
    if (id(liveViewerFilterBtn).visibleToUser().exists()) {
      anti.randomTapOnButton(id(liveViewerFilterBtn).findOne(2000))
      return true
    }
    // 通过文本/desc
    const filterKeywords = ['筛选', '排序', '全部', '筛选条件']
    for (let i = 0; i < filterKeywords.length; i++) {
      try {
        if (text(filterKeywords[i]).visibleToUser().exists()) {
          clickContent(filterKeywords[i], 'text')
          return true
        }
        if (desc(filterKeywords[i]).visibleToUser().exists()) {
          clickContent(filterKeywords[i], 'desc')
          return true
        }
      } catch (e) { /* ignore */ }
    }
    return false
  }

  // ============================================================
  // 观众列表处理（核心循环）
  // ============================================================

  /**
   * 循环处理观众列表
   *
   * 遍历当前可见的所有观众列表项，对每个男性用户执行关注操作
   * 当前页面关注完后自动向下滚动加载更多
   *
   * @returns {number} 本直播间关注的人数
   */
  function processViewerList() {
    toastLog('开始处理观众列表')
    log('【processViewerList】开始循环处理')

    let roomFollowedCount = 0
    let processedSet = [] // 已处理的用户标识列表（避免重复关注）
    let scrollCount = 0
    const maxScrolls = followerConfig.maxScrollsPerRoom()
    let consecutiveEmptyScrolls = 0

    // 主循环：关注 + 滚动
    while (scrollCount < maxScrolls) {
      // 检查上限
      if (checkLimits()) break

      // 获取当前可见的观众列表项
      const items = getVisibleViewerItems()
      log('【processViewerList】当前可见观众数：' + items.length)

      if (items.length === 0) {
        consecutiveEmptyScrolls++
        if (consecutiveEmptyScrolls >= 2) {
          toastLog('连续两次无更多观众，停止滚动')
          break
        }
      } else {
        consecutiveEmptyScrolls = 0
      }

      // 遍历当前页面的每个观众
      for (let i = 0; i < items.length; i++) {
        // 检查上限（每个观众都检查）
        if (checkLimits()) break

        const item = items[i]
        if (!item || !item.visibleToUser()) continue

        // 获取用户标识（用昵称或索引防重复）
        const userKey = getUserKey(item, i)
        if (processedSet.indexOf(userKey) !== -1) {
          log('【processViewerList】跳过已处理的用户：' + userKey)
          continue
        }
        processedSet.push(userKey)

        try {
          // ---- 性别判断 ----
          if (followerConfig.followMaleOnly()) {
            const isMale = isMaleUser(item)
            log('【processViewerList】用户 ' + userKey + ' 性别判断：' + (isMale ? '男' : '不是男/无法确定'))
            if (!isMale) {
              // 如果不是男性，跳过但不标记为已处理（因为可能判断不准确）
              // 但从去重列表移除以避免反复判断同一个非男性用户
              continue
            }
          }

          // ---- 点击关注 ----
          const followed = followUserInList(item, userKey)
          if (followed) {
            roomFollowedCount++
            sessionFollowedCount++
            followerConfig.incrementDayFollowed()

            log('【processViewerList】已关注：' + userKey +
                '（本直播间：' + roomFollowedCount +
                '，本次执行：' + sessionFollowedCount +
                '，今日：' + followerConfig.dayFollowedAmount() + '）')

            // 关注后随机停顿
            const delay = anti.humanLikeDelay(
              followerConfig.followMinDelay(),
              followerConfig.followMaxDelay()
            )
            log('【processViewerList】关注后停顿：' + delay + 'ms')
          }
        } catch (e) {
          log('【Error】processViewerList 处理单个用户异常：' + e)
          continue
        }
      }

      // 检查上限
      if (checkLimits()) break

      // ---- 滚动加载更多 ----
      scrollCount++
      if (scrollCount < maxScrolls) {
        toastLog('滚动观众列表（第 ' + scrollCount + '/' + maxScrolls + ' 次）')
        const waitTime = anti.randomScrollDown()
        // 等待列表加载新内容
        sleep(waitTime)
      }
    }

    toastLog('本直播间观众处理完毕，共操作 ' + roomFollowedCount + ' 人关注')
    return roomFollowedCount
  }

  /**
   * 检查关注上限
   * @returns {boolean} true = 达到上限，需要停止
   */
  function checkLimits() {
    if (sessionFollowedCount >= followerConfig.sessionFollowLimit()) {
      toastLog('达到本次执行关注上限（' + sessionFollowedCount + '/' + followerConfig.sessionFollowLimit() + '）')
      return true
    }
    if (followerConfig.dayFollowedAmount() >= followerConfig.dayFollowLimit()) {
      toastLog('达到当日关注上限（' + followerConfig.dayFollowedAmount() + '/' + followerConfig.dayFollowLimit() + '）')
      return true
    }
    return false
  }

  /**
   * 获取当前可见的观众列表项
   *
   * @returns {Array<UiObject>}
   */
  function getVisibleViewerItems() {
    const items = []

    try {
      // 方法1：通过列表项 ID
      if (id(liveViewerListItem).exists()) {
        const found = id(liveViewerListItem).find()
        for (let i = 0; i < found.length; i++) {
          if (found[i].visibleToUser()) {
            items.push(found[i])
          }
        }
        if (items.length > 0) {
          log('【getVisibleViewerItems】通过 ID 获取到 ' + items.length + ' 个可见项')
          return items
        }
      }

      // 方法2：从列表容器中获取子元素
      const listContainers = [
        id(liveViewerListPanel),
        className('androidx.recyclerview.widget.RecyclerView'),
        className('android.widget.ListView'),
      ]

      for (let ci = 0; ci < listContainers.length; ci++) {
        try {
          const container = listContainers[ci].visibleToUser().findOne(2000)
          if (container) {
            const children = container.children()
            if (children && children.length > 0) {
              for (let j = 0; j < children.length; j++) {
                const child = children[j]
                if (child && child.visibleToUser()) {
                  items.push(child)
                }
              }
              if (items.length > 0) {
                log('【getVisibleViewerItems】从容器获取到 ' + items.length + ' 个项')
                return items
              }
            }
          }
        } catch (e) { /* continue */ }
      }

      // 方法3：通过关注按钮反向查找
      // 观众列表中的每个项通常都有一个关注按钮
      if (id(liveViewerFollowBtn).exists()) {
        const followBtns = id(liveViewerFollowBtn).find()
        for (let i = 0; i < followBtns.length; i++) {
          if (followBtns[i].visibleToUser()) {
            // 尝试获取父级作为列表项
            try {
              const parent = followBtns[i].parent()
              if (parent) {
                items.push(parent)
              } else {
                // 如果无法获取父级，用按钮本身（只要能点击关注）
                items.push(followBtns[i])
              }
            } catch (e) {
              items.push(followBtns[i])
            }
          }
        }
        if (items.length > 0) {
          log('【getVisibleViewerItems】通过关注按钮获取到 ' + items.length + ' 个项')
        }
      }
    } catch (error) {
      log('【Error】getVisibleViewerItems 异常：' + error)
    }

    log('【getVisibleViewerItems】共获取到 ' + items.length + ' 个观众项')
    return items
  }

  // ============================================================
  // 性别判断
  // ============================================================

  /**
   * 判断一个观众是否为男性
   *
   * 使用多种特征综合判断：
   * 1. 性别图标（男女标识）
   * 2. 描述文本
   * 3. 性别文字标签
   * 4. 默认返回 true（如果无法判断则视为男性，避免漏掉）
   *
   * @param {UiObject} item - 观众列表项控件
   * @returns {boolean} true=男性, false=女性/无法判断
   */
  function isMaleUser(item) {
    if (!item) return true // 无法判断时默认为男性（宁可多关注也不漏掉）

    // ---- 收集项内所有文本信息 ----
    try {
      // 方法1：查找性别图标子控件
      if (id(liveViewerGenderIcon).exists()) {
        const genderIcons = id(liveViewerGenderIcon).find()
        for (let i = 0; i < genderIcons.length; i++) {
          const icon = genderIcons[i]
          if (icon && icon.visibleToUser()) {
            const desc = icon.desc()
            const text = icon.text()
            // 抖音性别图标 desc 通常为"男"或"女"
            if (desc === '男' || text === '男') return true
            if (desc === '女' || text === '女') return false
            // 有的版本用蓝色/粉色图标，需配合布局分析
          }
        }
      }

      // 方法2：扫描 item 内所有子控件的 desc 和 text
      const allText = getAllTextDeep(item)
      for (let i = 0; i < allText.length; i++) {
        const t = allText[i]
        if (t === '男') return true
        if (t === '女') return false
        if (t.indexOf('男') !== -1 && t.length < 5) return true
        if (t.indexOf('女') !== -1 && t.length < 5) return false
      }

      // 方法3：通过文本"男"或"女"在当前界面范围内查找
      // 只在当前 item 附近查找
      try {
        const itemBounds = item.bounds()
        if (itemBounds) {
          // 在 item 区域内查找男/女文字
          const maleText = text('男').findOne(100)
          if (maleText) {
            const maleBounds = maleText.bounds()
            if (maleBounds && isBoundsWithin(maleBounds, itemBounds)) {
              return true
            }
          }
          const femaleText = text('女').findOne(100)
          if (femaleText) {
            const femaleBounds = femaleText.bounds()
            if (femaleBounds && isBoundsWithin(femaleBounds, itemBounds)) {
              return false
            }
          }
        }
      } catch (e) { /* ignore */ }

      // 方法4：如果 item 包含"关注"按钮但没有任何性别标识
      // 检查是否有明确的性别排除标识
      if (hasFollowButton(item)) {
        // 无性别标识但有关注按钮 → 默认为男性（宁可不漏）
        return true
      }
    } catch (e) {
      log('【isMaleUser】判断异常，默认为男性：' + e)
      return true
    }

    // 默认：无法判断时假设为男性
    return true
  }

  /**
   * 深度获取控件及其所有子孙控件的文本内容
   * @param {UiObject} obj
   * @param {number} maxDepth
   * @returns {Array<string>}
   */
  function getAllTextDeep(obj, maxDepth) {
    const texts = []
    maxDepth = maxDepth || 5

    try {
      const text = obj.text()
      if (text && text.trim()) texts.push(text.trim())
    } catch (e) { /* ignore */ }
    try {
      const desc = obj.desc()
      if (desc && desc.trim()) texts.push(desc.trim())
    } catch (e) { /* ignore */ }

    if (maxDepth > 0) {
      try {
        const children = obj.children()
        if (children && children.length > 0) {
          for (let i = 0; i < children.length; i++) {
            const childTexts = getAllTextDeep(children[i], maxDepth - 1)
            for (let j = 0; j < childTexts.length; j++) {
              texts.push(childTexts[j])
            }
          }
        }
      } catch (e) { /* ignore */ }
    }

    return texts
  }

  /**
   * 判断 b1 是否完全在 b2 内部
   */
  function isBoundsWithin(b1, b2) {
    return b1.left >= b2.left && b1.top >= b2.top &&
           b1.right <= b2.right && b1.bottom <= b2.bottom
  }

  /**
   * 检查列表项中是否包含"关注"按钮
   */
  function hasFollowButton(item) {
    try {
      if (id(liveViewerFollowBtn).exists()) {
        const btns = id(liveViewerFollowBtn).find()
        for (let i = 0; i < btns.length; i++) {
          try {
            const btnBounds = btns[i].bounds()
            const itemBounds = item.bounds()
            if (btnBounds && itemBounds && isBoundsWithin(btnBounds, itemBounds)) {
              return true
            }
          } catch (e) { /* ignore */ }
        }
      }

      // 通过文本"关注"查找
      if (text('关注').exists()) {
        const followTexts = text('关注').find()
        for (let i = 0; i < followTexts.length; i++) {
          try {
            const tBounds = followTexts[i].bounds()
            const itemBounds = item.bounds()
            if (tBounds && itemBounds && isBoundsWithin(tBounds, itemBounds)) {
              return true
            }
          } catch (e) { /* ignore */ }
        }
      }
    } catch (e) { /* ignore */ }
    return false
  }

  /**
   * 获取用户在列表中的唯一标识（去重用）
   */
  function getUserKey(item, index) {
    try {
      // 优先用昵称
      if (id(liveViewerItemName).exists()) {
        const names = id(liveViewerItemName).find()
        for (let i = 0; i < names.length; i++) {
          try {
            const nameBounds = names[i].bounds()
            const itemBounds = item.bounds()
            if (nameBounds && itemBounds && isBoundsWithin(nameBounds, itemBounds)) {
              const name = names[i].text() || names[i].desc()
              if (name && name.trim()) {
                return 'name_' + name.trim()
              }
            }
          } catch (e) { /* ignore */ }
        }
      }

      // 后备：用 item 的 bounds 字符串
      const bounds = item.bounds()
      if (bounds) {
        return 'pos_' + bounds.left + '_' + bounds.top
      }
    } catch (e) { /* ignore */ }

    return 'idx_' + index
  }

  // ============================================================
  // 关注操作
  // ============================================================

  /**
   * 在观众列表项中点击"关注"按钮
   *
   * @param {UiObject} item - 观众列表项
   * @param {string} userKey - 用户标识（仅用于日志）
   * @returns {boolean} 是否成功关注
   */
  function followUserInList(item, userKey) {
    try {
      log('【followUserInList】尝试关注用户：' + userKey)

      // 概率判断：不是每个符合条件的用户都关注
      if (!anti.chance(followerConfig.followProbability())) {
        log('【followUserInList】概率触发不关注：' + userKey)
        return false
      }

      // ---- 策略1：通过列表项内的"关注"按钮 ID ----
      if (id(liveViewerFollowBtn).exists()) {
        const btns = id(liveViewerFollowBtn).find()
        for (let i = 0; i < btns.length; i++) {
          const btn = btns[i]
          if (!btn || !btn.visibleToUser()) continue

          try {
            // 确认按钮在这个 item 范围内
            const btnBounds = btn.bounds()
            const itemBounds = item.bounds()
            if (btnBounds && itemBounds && isBoundsWithin(btnBounds, itemBounds)) {
              const btnText = btn.text() || btn.desc() || ''
              // 确保是"关注"而不是"已关注"或"互相关注"
              if (btnText.indexOf('关注') !== -1 && btnText.indexOf('已') === -1 && btnText.indexOf('互') === -1) {
                anti.randomTapOnButton(btn,
                  followerConfig.tapOffsetMin(),
                  followerConfig.tapOffsetMax()
                )
                log('【followUserInList】通过 ID 点击关注成功：' + userKey)
                // 等待关注操作完成
                anti.actionPause(500, 1000)
                return true
              }
            }
          } catch (e) { /* continue */ }
        }
      }

      // ---- 策略2：在 item 范围内找 text="关注" 的控件 ----
      try {
        const followTextEls = text('关注').find()
        for (let i = 0; i < followTextEls.length; i++) {
          const el = followTextEls[i]
          if (!el || !el.visibleToUser()) continue

          try {
            const elBounds = el.bounds()
            const itemBounds = item.bounds()
            if (elBounds && itemBounds && isBoundsWithin(elBounds, itemBounds)) {
              // 检查 parent button 是否可点击（有些版本的关注是 Button 容器）
              const parent = el.parent()
              if (parent && parent.clickable()) {
                anti.randomTapOnButton(parent,
                  followerConfig.tapOffsetMin(),
                  followerConfig.tapOffsetMax()
                )
              } else {
                anti.randomTapOnButton(el,
                  followerConfig.tapOffsetMin(),
                  followerConfig.tapOffsetMax()
                )
              }
              log('【followUserInList】通过 text 点击关注成功：' + userKey)
              anti.actionPause(500, 1000)
              return true
            }
          } catch (e) { /* continue */ }
        }
      } catch (e) { /* ignore */ }

      // ---- 策略3：通过 desc="关注" ----
      try {
        if (desc('关注').exists()) {
          const descEls = desc('关注').find()
          for (let i = 0; i < descEls.length; i++) {
            const el = descEls[i]
            if (!el || !el.visibleToUser()) continue
            try {
              const elBounds = el.bounds()
              const itemBounds = item.bounds()
              if (elBounds && itemBounds && isBoundsWithin(elBounds, itemBounds)) {
                anti.randomTapOnButton(el,
                  followerConfig.tapOffsetMin(),
                  followerConfig.tapOffsetMax()
                )
                log('【followUserInList】通过 desc 点击关注成功：' + userKey)
                anti.actionPause(500, 1000)
                return true
              }
            } catch (e) { /* continue */ }
          }
        }
      } catch (e) { /* ignore */ }

      // ---- 策略4：坐标点击 item 右侧区域（关注按钮通常在右侧） ----
      try {
        const itemBounds = item.bounds()
        if (itemBounds) {
          const btnX = randomInRange(itemBounds.right - 100, itemBounds.right - 20)
          const btnY = randomInRange(itemBounds.top + 10, itemBounds.bottom - 10)
          log('【followUserInList】通过坐标点击关注区域：(' + btnX + ', ' + btnY + ')')
          press(btnX, btnY, anti.pressHoldDuration())
          anti.actionPause(500, 1000)
          // 没有确认机制，只能假设成功
          log('【followUserInList】坐标点击完成：' + userKey)
          return true
        }
      } catch (e) { /* ignore */ }

      log('【followUserInList】未找到关注按钮：' + userKey)
      return false
    } catch (error) {
      log('【Error】followUserInList 异常：' + error)
      return false
    }
  }

  // ============================================================
  // 观众列表关闭
  // ============================================================

  /**
   * 关闭观众列表
   */
  function closeViewerList() {
    toastLog('关闭观众列表')
    try {
      // 方法1：通过关闭按钮
      if (id(liveViewerClose).visibleToUser().exists()) {
        anti.randomTapOnButton(id(liveViewerClose).findOne(2000))
        anti.actionPause(500, 1000)
        return
      }
      // 方法2：通过 desc="关闭"
      if (desc('关闭').visibleToUser().exists()) {
        clickContent('关闭', 'desc')
        anti.actionPause(500, 1000)
        return
      }
      // 方法3：通过 text 含"关闭"
      if (textContains('关闭').visibleToUser().exists()) {
        clickContent('关闭', 'text')
        anti.actionPause(500, 1000)
        return
      }
      // 方法4：按返回键
      back()
      anti.actionPause(800, 1200)

      // 再次确认是否关闭
      if (isViewerListVisible()) {
        back()
        anti.actionPause(500, 1000)
      }
    } catch (error) {
      log('【closeViewerList】异常：' + error)
      try { back() } catch (e) { /* ignore */ }
    }
  }

  // ============================================================
  // 直播间切换
  // ============================================================

  /**
   * 滑动到下一个直播间
   *
   * 使用原项目的 liveSwipe() 函数：
   * 从屏幕中下部向上滑动，模拟手指上滑切换直播间
   */
  function swipeToNextLive() {
    toastLog('切换到下一个直播间')
    log('【swipeToNextLive】开始切换')
    anti.actionPause(1000, 2000)

    try {
      // 使用原项目的直播间滑动函数
      liveSwipe()
      log('【swipeToNextLive】滑动完成')

      // 滑动后等待新直播间加载
      anti.humanLikeDelay(3000, 5000)
    } catch (error) {
      log('【Error】swipeToNextLive 异常：' + error)
      // 降级：使用通用随机滑动
      randomSwipe()
      randomSleep(3000)
    }
  }

  // ============================================================
  // 工具函数（本模块私有）
  // ============================================================

  /**
   * 生成范围内的随机整数
   */
  function randomInRange(min, max) {
    return Math.round(Math.random() * (max - min) + min)
  }

  /**
   * 固定范围延时 + 随机抖动
   */
  function actionPause(min, max) {
    sleep(randomInRange(min || 500, max || 1500))
  }

  // ============================================================
  // 导出模块
  // ============================================================

  module.exports = main
})()
