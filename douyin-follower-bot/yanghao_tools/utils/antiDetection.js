/**
 * 增强反检测工具函数
 *
 * 职责：提供比原项目 util.js 更精细的真人模拟操作
 * - 随机延时 + 微小抖动（模拟人类反应时间不一致）
 * - 在控件边界内随机偏移点击
 * - 带随机速度和路径的仿真滑动
 * - 操作间随机停顿
 *
 * 使用方式：在 liveRoomFollower.js 中 require 本模块
 *   const anti = require('../utils/antiDetection')
 *   anti.humanLikeDelay(3000, 8000)
 *   anti.randomTapOnButton(btn)
 *
 * @see 原基础函数在 util.js（本模块是对其的增强补充，不替代）
 */

// ============================================================
// 延时控制
// ============================================================

/**
 * 类人随机延时 — 带非线性抖动
 *
 * 人类点击后的反应时间不是均匀分布的，通常集中在某个区间但有长尾。
 * 本函数使用双峰分布模拟：
 * - 80% 概率在 [min, min + (max-min)*0.6] 范围内（正常操作）
 * - 20% 概率在 [min + (max-min)*0.6, max] 范围内（偶尔走神/多看几眼）
 *
 * @param {number} minDelay 最小延时（毫秒）
 * @param {number} maxDelay 最大延时（毫秒）
 * @returns {number} 实际睡眠的毫秒数
 */
function humanLikeDelay(minDelay, maxDelay) {
  // 输入保护
  minDelay = minDelay || 3000
  maxDelay = maxDelay || 8000
  if (minDelay > maxDelay) {
    const temp = minDelay
    minDelay = maxDelay
    maxDelay = temp
  }

  const range = maxDelay - minDelay
  let delay

  if (Math.random() < 0.8) {
    // 80% 正常操作区间
    delay = minDelay + Math.random() * range * 0.6
  } else {
    // 20% 长尾区间
    delay = minDelay + range * 0.6 + Math.random() * range * 0.4
  }

  // 加入 ±5% 的微小抖动
  delay = delay * (0.95 + Math.random() * 0.1)

  const actualDelay = Math.round(delay)
  sleep(actualDelay)
  return actualDelay
}

/**
 * 按键按下后的微停顿 — 模拟人类从按下到抬起的时间不一致
 *
 * @param {number} baseMin 基础最小按压时间（ms，默认 50）
 * @param {number} baseMax 基础最大按压时间（ms，默认 150）
 * @returns {number} 实际按压时间
 */
function pressHoldDuration(baseMin, baseMax) {
  baseMin = baseMin || 50
  baseMax = baseMax || 150
  // 按压时间呈偏态分布：多数点击快，偶尔按得久
  let duration
  if (Math.random() < 0.7) {
    duration = baseMin + Math.random() * (baseMax - baseMin) * 0.5
  } else {
    duration = baseMin + Math.random() * (baseMax - baseMin)
  }
  return Math.round(duration)
}

/**
 * 操作间隔停顿 — 在两个不同类型的操作之间使用
 * 比 humanLikeDelay 更短，模拟操作间的自然停顿
 *
 * @param {number} min 最小（ms，默认 800）
 * @param {number} max 最大（ms，默认 2000）
 */
function actionPause(min, max) {
  min = min || 800
  max = max || 2000
  const pause = min + Math.random() * (max - min)
  sleep(Math.round(pause))
}

// ============================================================
// 随机点击
// ============================================================

/**
 * 在控件 bounds 范围内随机偏移点击
 *
 * 比原项目 clickButton() 更灵活：
 * - 偏移量可配置
 * - 点击时长随机
 * - 偶尔（5%概率）模拟"多点了一下"的动作
 *
 * @param {UiObject|Object} button - 控件对象，必须有 bounds() 方法
 * @param {number} offsetMin - 最小偏移像素（默认 5）
 * @param {number} offsetMax - 最大偏移像素（默认 30）
 * @returns {boolean} 是否点击成功
 */
function randomTapOnButton(button, offsetMin, offsetMax) {
  if (!button) {
    log('【antiDetection】randomTapOnButton 失败：button 为空')
    return false
  }

  offsetMin = offsetMin || 5
  offsetMax = offsetMax || 30

  try {
    const bounds = button.bounds()
    if (!bounds) {
      log('【antiDetection】button.bounds() 为空')
      return false
    }

    const x = randomInRange(bounds.left + offsetMin, bounds.right - offsetMin)
    const y = randomInRange(bounds.top + offsetMin, bounds.bottom - offsetMin)
    const duration = pressHoldDuration()

    log('【antiDetection】点击坐标：(' + x + ', ' + y + ')，按压：' + duration + 'ms')
    const result = press(x, y, duration)

    // 5% 概率模拟"多点了一下"
    if (result && Math.random() < 0.05) {
      sleep(randomInRange(100, 300))
      const x2 = randomInRange(bounds.left + offsetMin, bounds.right - offsetMin)
      const y2 = randomInRange(bounds.top + offsetMin, bounds.bottom - offsetMin)
      press(x2, y2, pressHoldDuration(30, 80))
      log('【antiDetection】模拟第二次轻点')
    }

    return result
  } catch (e) {
    log('【antiDetection】randomTapOnButton 异常：' + e)
    return false
  }
}

/**
 * 在指定区域内随机点击
 *
 * 当没有控件对象、只有坐标区域时使用
 *
 * @param {number} left - 区域左边界
 * @param {number} top - 区域上边界
 * @param {number} right - 区域右边界
 * @param {number} bottom - 区域下边界
 * @param {number} offsetMin - 边缘最小偏移（默认 5）
 * @param {number} offsetMax - 边缘最大偏移（默认 20）
 * @returns {boolean} 是否点击成功
 */
function randomTapInRegion(left, top, right, bottom, offsetMin, offsetMax) {
  offsetMin = offsetMin || 5
  offsetMax = offsetMax || 20
  const x = randomInRange(left + offsetMin, right - offsetMin)
  const y = randomInRange(top + offsetMin, bottom - offsetMin)
  const duration = pressHoldDuration()

  log('【antiDetection】区域点击：(' + x + ', ' + y + ')')
  return press(x, y, duration)
}

// ============================================================
// 仿真滑动
// ============================================================

/**
 * 带随机控制点偏移的贝塞尔滑动
 *
 * 在原项目 smlMove() 基础上增加了更多随机性：
 * - 控制点位置随机偏移范围更大
 * - 滑动速度随机 ±25%
 * - 10% 概率模拟"滑到一半停顿一下"
 *
 * @param {number} startX - 起点 X
 * @param {number} startY - 起点 Y
 * @param {number} endX - 终点 X
 * @param {number} endY - 终点 Y
 * @param {number} baseTime - 基础滑动时间（ms）
 */
function humanLikeSwipe(startX, startY, endX, endY, baseTime) {
  baseTime = baseTime || randomInRange(300, 600)

  // 控制点随机偏移
  const offsetRange = Math.max(Math.abs(endX - startX), Math.abs(endY - startY)) * 0.3
  offsetRange = Math.max(offsetRange, 50)

  const control1x = startX + (endX - startX) * 0.3 + randomInRange(-offsetRange * 0.3, offsetRange * 0.3)
  const control1y = startY + (endY - startY) * 0.2 + randomInRange(-offsetRange * 0.2, offsetRange * 0.2)
  const control2x = startX + (endX - startX) * 0.7 + randomInRange(-offsetRange * 0.3, offsetRange * 0.3)
  const control2y = startY + (endY - startY) * 0.8 + randomInRange(-offsetRange * 0.2, offsetRange * 0.2)

  // 构建贝塞尔曲线路径点
  const time = baseTime * (0.75 + Math.random() * 0.5) // ±25% 速度变化
  const steps = Math.max(Math.round(time / 40), 5)
  const points = []

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = Math.round(
      Math.pow(1 - t, 3) * startX +
      3 * Math.pow(1 - t, 2) * t * control1x +
      3 * (1 - t) * Math.pow(t, 2) * control2x +
      Math.pow(t, 3) * endX
    )
    const y = Math.round(
      Math.pow(1 - t, 3) * startY +
      3 * Math.pow(1 - t, 2) * t * control1y +
      3 * (1 - t) * Math.pow(t, 2) * control2y +
      Math.pow(t, 3) * endY
    )
    points.push([x, y])
  }

  // 10% 概率模拟"滑到一半停顿一下"
  if (Math.random() < 0.1 && points.length > 4) {
    const pauseIndex = Math.floor(points.length / 2)
    const pauseAt = points[pauseIndex]
    log('【antiDetection】滑动中模拟停顿：(' + pauseAt[0] + ', ' + pauseAt[1] + ')')

    // 前半段正常滑
    const firstHalf = [time * 0.4].concat(points.slice(0, pauseIndex + 1))
    gesture.apply(null, firstHalf.flat())
    sleep(randomInRange(200, 500))
    // 后半段继续滑
    const secondHalf = [time * 0.6].concat(points.slice(pauseIndex))
    gesture.apply(null, secondHalf.flat())
  } else {
    // 正常滑完
    gesture.apply(null, [time].concat(points.flat()))
  }

  log('【antiDetection】贝塞尔滑动完成：(' + startX + ',' + startY + ') → (' + endX + ',' + endY + ')，耗时：' + time + 'ms')
}

/**
 * 随机向下滑动列表（用于观众列表滚动）
 *
 * 每次滑动距离和速度都不同
 */
function randomScrollDown() {
  const width = device.width
  const height = device.height

  // 随机滑动的起始和终点
  const startX = randomInRange(width * 0.3, width * 0.7)
  const startY = randomInRange(height * 0.6, height * 0.8)
  const endY = randomInRange(height * 0.2, height * 0.4)
  const offsetX = randomInRange(-30, 30)

  humanLikeSwipe(startX, startY, startX + offsetX, endY, randomInRange(250, 500))

  // 滚动后随机等待
  const waitTime = randomInRange(800, 2000)
  log('【antiDetection】列表滚动后等待：' + waitTime + 'ms')
  return waitTime
}

/**
 * 随机向上滑动（关闭/返回用途）
 */
function randomScrollUp() {
  const width = device.width
  const height = device.height

  const startX = randomInRange(width * 0.3, width * 0.7)
  const startY = randomInRange(height * 0.2, height * 0.4)
  const endY = randomInRange(height * 0.6, height * 0.8)

  humanLikeSwipe(startX, startY, startX, endY, randomInRange(200, 400))
  sleep(randomInRange(500, 1200))
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 生成范围内的随机整数
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInRange(min, max) {
  return Math.round(Math.random() * (max - min) + min)
}

/**
 * 带概率的布尔判断
 * @param {number} probability - 0-1 之间的概率
 * @returns {boolean}
 */
function chance(probability) {
  return Math.random() < (probability || 0.5)
}

/**
 * 随机选择数组中的一个元素
 * @param {Array} arr
 * @returns {*}
 */
function randomChoice(arr) {
  if (!arr || arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  // 延时
  humanLikeDelay: humanLikeDelay,
  pressHoldDuration: pressHoldDuration,
  actionPause: actionPause,
  // 随机点击
  randomTapOnButton: randomTapOnButton,
  randomTapInRegion: randomTapInRegion,
  // 仿真滑动
  humanLikeSwipe: humanLikeSwipe,
  randomScrollDown: randomScrollDown,
  randomScrollUp: randomScrollUp,
  // 工具
  randomInRange: randomInRange,
  chance: chance,
  randomChoice: randomChoice,
}
