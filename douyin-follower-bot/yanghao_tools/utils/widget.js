// douyin
const homePageWidget = 'com.ss.android.ugc.aweme:id/wwb' // 首页按钮控件
const likeWidget = 'com.ss.android.ugc.aweme:id/ev4' // 视频点赞按钮控件
const commentWidget = 'com.ss.android.ugc.aweme:id/c+1' // 评论按钮控件
const commentPopupWidget = 'com.ss.android.ugc.aweme:id/tqf' // 评论框弹窗界面
const commentInputWidget = 'com.ss.android.ugc.aweme:id/c7p' // 评论输入框控件
const commentInputSendWidget = 'com.ss.android.ugc.aweme:id/c=1' // 评论发送控件
const commentCloseWidget = 'com.ss.android.ugc.aweme:id/back_btn' // 评论关闭控件
const collectWidget = 'com.ss.android.ugc.aweme:id/c32' // 收藏按钮控件
const liveClose = 'com.ss.android.ugc.aweme:id/root' // 关闭直播间
const livePersonAmountWidget = 'com.ss.android.ugc.aweme:id/p25' // 直播间人数控件
const liveUserCommentWidget = 'com.ss.android.ugc.aweme:id/text' // 直播间用户评论控件
const liveUserPopupTopWidget = 'com.ss.android.ugc.aweme:id/yc_' // 直播间用户详情上面区域
const liveUserPopupBottomWidget = 'com.ss.android.ugc.aweme:id/x7z' // 直播间用户详情下面区域
const liveUserFocusWidget = 'com.ss.android.ugc.aweme:id/09h' // 直播间用户详情关注数
const liveUserFansWidget = 'com.ss.android.ugc.aweme:id/09l' // 直播间用户详情粉丝数
const liveUserAvatar = 'com.ss.android.ugc.aweme:id/pm7' // 直播间用户详情头像
const liveUserInfoAreaWidget = 'com.ss.android.ugc.aweme:id/qfa' // 直播间进入用户详情页资料信息区域
const liveUserInfoPageWidget = 'com.ss.android.ugc.aweme:id/r8y' // 直播间用户详情页页面
const searchContainerWidget = 'com.ss.android.ugc.aweme:id/qcx' // 搜索框外层容器控件
const searchInputWidget = 'com.ss.android.ugc.aweme:id/et_search_kw' // 搜索页输入框控件
const searchButtonWidget = 'com.ss.android.ugc.aweme:id/z5o' // 搜索框搜索按钮控件
const searchTagWidget = 'android:id/text1' // 搜索页标签分类控件
const searchVideoWidget = 'com.ss.android.ugc.aweme:id/ttf' // 搜索页视频控件

// ============================================================
// 新增：直播间观众列表相关控件
//
// ⚠️ 重要：这些 ID 需要你用 Autox.js 的「布局分析」工具
// 在当前抖音版本上抓取实际值后填入。
// 参考 README2.md 第六章「选择器适配指南」
//
// 如果你的抖音版本中这些控件没有固定 ID，可以使用
// text() / desc() / className() 等备选方案，代码中已内置后备逻辑。
// ============================================================

const liveViewerListButton = 'com.ss.android.ugc.aweme:id/xxx' // 在线观众按钮（直播间底部"xx人正在看"）
const liveViewerListPanel = 'com.ss.android.ugc.aweme:id/xxx'  // 观众列表面板（整个浮层容器）
const liveViewerListItem = 'com.ss.android.ugc.aweme:id/xxx'   // 观众列表中的单个用户项
const liveViewerItemName = 'com.ss.android.ugc.aweme:id/xxx'   // 观众昵称文字
const liveViewerGenderIcon = 'com.ss.android.ugc.aweme:id/xxx' // 性别图标（男女标识）
const liveViewerFollowBtn = 'com.ss.android.ugc.aweme:id/xxx'  // 列表项上的"关注"按钮
const liveViewerFilterBtn = 'com.ss.android.ugc.aweme:id/xxx'  // 筛选按钮
const liveViewerFilterMale = 'com.ss.android.ugc.aweme:id/xxx' // 筛选面板-男性选项
const liveViewerFilterConfirm = 'com.ss.android.ugc.aweme:id/xxx' // 筛选面板-确认按钮
const liveViewerClose = 'com.ss.android.ugc.aweme:id/xxx'      // 关闭观众列表按钮

module.exports = {
  // === 原控件（养号助手使用） ===
  homePageWidget: homePageWidget,
  likeWidget: likeWidget,
  commentWidget: commentWidget,
  commentPopupWidget: commentPopupWidget,
  commentInputWidget: commentInputWidget,
  commentInputSendWidget: commentInputSendWidget,
  commentCloseWidget: commentCloseWidget,
  collectWidget: collectWidget,
  liveClose: liveClose,
  livePersonAmountWidget: livePersonAmountWidget,
  liveUserCommentWidget: liveUserCommentWidget,
  liveUserPopupTopWidget: liveUserPopupTopWidget,
  liveUserPopupBottomWidget: liveUserPopupBottomWidget,
  liveUserAvatar: liveUserAvatar,
  liveUserFocusWidget: liveUserFocusWidget,
  liveUserFansWidget: liveUserFansWidget,
  liveUserInfoAreaWidget: liveUserInfoAreaWidget,
  liveUserInfoPageWidget: liveUserInfoPageWidget,
  searchContainerWidget: searchContainerWidget,
  searchInputWidget: searchInputWidget,
  searchButtonWidget: searchButtonWidget,
  searchTagWidget: searchTagWidget,
  searchVideoWidget: searchVideoWidget,

  // === 新增控件（直播间关注使用） ===
  liveViewerListButton: liveViewerListButton,
  liveViewerListPanel: liveViewerListPanel,
  liveViewerListItem: liveViewerListItem,
  liveViewerItemName: liveViewerItemName,
  liveViewerGenderIcon: liveViewerGenderIcon,
  liveViewerFollowBtn: liveViewerFollowBtn,
  liveViewerFilterBtn: liveViewerFilterBtn,
  liveViewerFilterMale: liveViewerFilterMale,
  liveViewerFilterConfirm: liveViewerFilterConfirm,
  liveViewerClose: liveViewerClose,
}