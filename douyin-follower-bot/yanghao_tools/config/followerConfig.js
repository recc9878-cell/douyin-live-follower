/**
 * 直播间关注脚本 — 配置存储模块
 *
 * 基于原项目 storageDaliy.js 的模式，使用 storages.create() 持久化配置。
 * 所有可调参数集中管理，UI 配置通过 saveConfig() 写入。
 *
 * 存储 key 前缀：follower_
 * 存储空间名：FollowerBot__Config
 */

const storage = storages.create('FollowerBot__Config')
const prefix = 'follower_'

// ============================================================
// 配置保存（UI 页面点击运行时调用）
// ============================================================

/**
 * 从 UI 控件读取值并保存到存储
 * 在 ui.js 中点击「运行」按钮时调用
 */
function saveConfig() {
  const inputs = [
    'followMinDelay',
    'followMaxDelay',
    'tapOffsetMin',
    'tapOffsetMax',
    'sessionFollowLimit',
    'dayFollowLimit',
    'maxScrollsPerRoom',
    'scrollDelayMin',
    'scrollDelayMax',
    'followProbability',
  ]
  inputs.forEach(function (val) {
    const uiId = prefix + val
    const uiEl = ui[uiId]
    if (uiEl) {
      storage.put(val, uiEl.text())
    }
  })

  // switch 控件单独处理
  if (ui.follower_followMaleOnly) {
    storage.put('followMaleOnly', ui.follower_followMaleOnly.isChecked())
  }
  if (ui.follower_debugMode) {
    storage.put('debugMode', ui.follower_debugMode.isChecked())
  }

  log('【followerConfig】配置已保存')
}

// ============================================================
// 配置读取（各配置项默认值）
// ============================================================

module.exports = {
  storage: storage,

  // ======== 延时设置 ========

  /** 关注最小间隔（ms） */
  followMinDelay: function () {
    return parseInt(storage.get('followMinDelay', 3000))
  },
  /** 关注最大间隔（ms） */
  followMaxDelay: function () {
    return parseInt(storage.get('followMaxDelay', 8000))
  },

  // ======== 点击偏移 ========

  /** 点击最小偏移（px） */
  tapOffsetMin: function () {
    return parseInt(storage.get('tapOffsetMin', 5))
  },
  /** 点击最大偏移（px） */
  tapOffsetMax: function () {
    return parseInt(storage.get('tapOffsetMax', 30))
  },

  // ======== 关注控制 ========

  /** 是否仅关注男性 */
  followMaleOnly: function () {
    return storage.get('followMaleOnly', true)
  },
  /** 单次执行关注上限 */
  sessionFollowLimit: function () {
    return parseInt(storage.get('sessionFollowLimit', 20))
  },
  /** 单日关注上限 */
  dayFollowLimit: function () {
    return parseInt(storage.get('dayFollowLimit', 80))
  },
  /** 符合条件时关注概率（0-1） */
  followProbability: function () {
    return parseFloat(storage.get('followProbability', 0.9))
  },

  // ======== 列表滚动 ========

  /** 每个直播间最多滑几次列表 */
  maxScrollsPerRoom: function () {
    return parseInt(storage.get('maxScrollsPerRoom', 3))
  },
  /** 滚动后最小等待（ms） */
  scrollDelayMin: function () {
    return parseInt(storage.get('scrollDelayMin', 1000))
  },
  /** 滚动后最大等待（ms） */
  scrollDelayMax: function () {
    return parseInt(storage.get('scrollDelayMax', 2500))
  },

  // ======== 调试 ========

  /** 是否输出详细日志 */
  debugMode: function () {
    return storage.get('debugMode', true)
  },

  // ======== 运行时状态（非 UI 配置） ========

  /** 当日已关注人数 */
  dayFollowedAmount: function () {
    return storage.get('dayFollowedAmount', 0)
  },
  /** 脚本最后运行时间 */
  lastRunTime: function () {
    return storage.get('lastRunTime', new Date().getTime())
  },

  // ======== 状态更新方法 ========

  /** 当日关注数 +1 */
  incrementDayFollowed: function () {
    const current = this.dayFollowedAmount()
    storage.put('dayFollowedAmount', current + 1)
    return current + 1
  },
  /** 重置当日关注数（每天首次运行时调用） */
  resetDayFollowed: function () {
    storage.put('dayFollowedAmount', 0)
    log('【followerConfig】当日关注数已重置为 0')
  },
  /** 更新最后运行时间 */
  updateLastRunTime: function () {
    storage.put('lastRunTime', new Date().getTime())
  },

  /** 保存配置方法 */
  saveConfig: saveConfig,
}
