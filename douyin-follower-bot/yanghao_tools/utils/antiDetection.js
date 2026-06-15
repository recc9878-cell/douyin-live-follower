/**
 * 反检测工具 — 让操作看起来像真人
 *
 * 用法：
 *   const anti = require('./antiDetection')
 *   anti.randomTap(btn)           // 在按钮范围内随机偏移点击
 *   anti.randomDelay(3000, 8000)  // 随机等待 3-8 秒
 *   anti.scrollDown()              // 随机滚动列表
 */

// ============================================================
// 随机点击
// ============================================================

/** 在控件范围内随机偏移点击（偏移 5-30px，按压 50-150ms） */
function randomTap(button, offsetMin, offsetMax) {
  if (!button) return false
  offsetMin = offsetMin || 5
  offsetMax = offsetMax || 30
  try {
    const b = button.bounds()
    if (!b) return false
    const x = rand(b.left + offsetMin, b.right - offsetMin)
    const y = rand(b.top + offsetMin, b.bottom - offsetMin)
    const duration = rand(50, 150)
    log('点击 (' + x + ',' + y + ') 按压' + duration + 'ms')
    return press(x, y, duration)
  } catch (e) {
    return false
  }
}

// ============================================================
// 随机延时
// ============================================================

/** 类人随机延时（双峰分布：80%正常区间，20%长尾） */
function randomDelay(min, max) {
  min = min || 3000
  max = max || 8000
  if (min > max) { let t = min; min = max; max = t }
  const range = max - min
  const delay = Math.random() < 0.8
    ? min + range * 0.6 * Math.random()
    : min + range * 0.6 + range * 0.4 * Math.random()
  const actual = Math.round(delay * (0.95 + Math.random() * 0.1))
  log('等待 ' + actual + 'ms')
  sleep(actual)
  return actual
}

// ============================================================
// 随机滑动
// ============================================================

/** 观众列表向下随机滚动，返回后等待时间（800-2000ms） */
function scrollDown() {
  const w = device.width, h = device.height
  const sx = rand(w * 0.3, w * 0.7)
  const sy = rand(h * 0.7, h * 0.85)
  const ey = rand(h * 0.2, h * 0.4)
  const time = rand(250, 500)
  swipe(sx, sy, sx + rand(-30, 30), ey, time)
  const wait = rand(800, 2000)
  log('滚动后等待 ' + wait + 'ms')
  sleep(wait)
}

// ============================================================
// 简化工具
// ============================================================

function rand(min, max) {
  return Math.round(Math.random() * (max - min) + min)
}

/** 按概率返回 true */
function chance(p) {
  return Math.random() < (p || 0.5)
}

/** 随机按压时长 */
function pressDuration() {
  return rand(50, 150)
}

module.exports = {
  randomTap: randomTap,
  randomDelay: randomDelay,
  scrollDown: scrollDown,
  chance: chance,
  pressDuration: pressDuration,
  rand: rand,
}
