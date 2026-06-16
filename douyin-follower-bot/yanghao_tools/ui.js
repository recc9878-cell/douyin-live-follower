"ui";
const startDouyinDaliyWork = require('./modules/douyinDaliyWork')
const startDouyinNewWork = require('./modules/douyinNewWork')
const startKsYanghaoWork = require('./modules/ksYanghaoWork')
const startLiveRoomFollower = require('./modules/liveRoomFollower')
const storageDaliyConfig = require('./config/storageDaliy');
const storageNewConfig = require('./config/storageNew');
const storageKsYanghaoConfig = require('./config/storageKsYanghao');
const followerConfig = require('./config/followerConfig');
const Utils = require('./utils/util')
// dayjs 是 AutoJs6 全局内置，不需要 require
const fillAppVersion = '30.1.0' // 适配的版本
const fillKsAppVersion = '10.9.21.28058' // 适配的版本
let isFillVer = true // 是否适配版本
let isFillKsVer = true // 是否适配版本

const today = dayjs(new Date().getTime()).format('YYYY-MM-DD')

// ======== 抖音每日任务 ========
// 查看脚本最后运行时间是否当天，不是则把 当日直播间 参数重置
const lastRunTime = dayjs(storageDaliyConfig.lastRunTime()).format('YYYY-MM-DD')
if (today !== lastRunTime) {
  storageDaliyConfig.storageDaliy.put('dayLiveUserFocusAmount', 0)
}
// ======== 抖音每日任务 End ========

// ======== 直播间关注 ========
// 查看脚本最后运行时间是否当天，不是则把当日关注数重置
const lastRunTimeForFollower = dayjs(followerConfig.lastRunTime()).format('YYYY-MM-DD')
if (today !== lastRunTimeForFollower) {
  followerConfig.resetDayFollowed()
}
// ======== 直播间关注 End ========

// ======== 快手养号 ========
// 查看脚本最后运行时间是否当天，不是则把 当日直播间 参数重置
const lastRunTimeForKsYanghao = dayjs(storageKsYanghaoConfig.lastRunTime()).format('YYYY-MM-DD')
if (today !== lastRunTimeForKsYanghao) {
  storageKsYanghaoConfig.storagesKsYanghao.put('dayLiveUserFocusAmount', 0)
}
// ======== 快手养号 End ========

ui.statusBarColor("#1495E7")
ui.layout(
  <frame>
    <vertical>
      <appbar>
        <toolbar id="toolbar" bg="#1495E7" title="养号助手"></toolbar>
        <tabs id="tabs" bg="#1495E7" />
      </appbar>
      <viewpager id="viewpager">
        {/* 抖音每日任务 */}
        <ScrollView>
          <vertical>
            <card w="*" h="*" margin="10 5" cardCornerRadius="2dp" cardElevation="1dp" foreground="?selectableItemBackground">
              <horizontal gravity="center_vertical">
                <View bg="#1495E7" h="*" w="5" />
                <vertical padding="10 8" h="auto" w="0" layout_weight="1">
                  <horizontal padding="0 5"><text text="[当前脚本版本]" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="{{app.versionName}}" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="[支持版本]" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="抖音 version{{fillAppVersion}}" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="[支持版本APK下载地址]" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text autoLink="all" text="https://www.wandoujia.com/apps/7461948/history_v300101" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="[功能说明] " textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="退出脚本：点击音量上即可退出脚本" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="[任务介绍] " textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="进入首页-推荐，观看视频，每条15-30s，根据设置的条件进行点赞评论收藏，遇到直播间点击进入（每个直播间停留60s-120s）点击用户名，识别用户条件（性别、地区、关注数、粉丝数），点击关注，回到直播间重复点击用户名动作（部分设置不可关注用户的直播间直接划过），下滑直播间重复以上动作，观看完10个直播间或刷到直播结束跳出直播界面，重复执行第1点。" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text id="title" text="[数据展示]" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text id="title" text="当日直播间已关注人数：{{storageDaliyConfig.dayLiveUserFocusAmount()}}" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text id="title" text="脚本最后运行时间：{{dayjs(storageDaliyConfig.lastRunTime()).format('YYYY-MM-DD HH:mm:ss')}}" textSize="13sp" /></horizontal>
                </vertical>
              </horizontal>
            </card>
            <card w="*" h="*" margin="10" cardCornerRadius="2dp" cardElevation="1dp" foreground="?selectableItemBackground">
              <horizontal gravity="center_vertical">
                <View bg="#1495E7" h="*" w="5" />
                <vertical padding="10 8" h="auto" w="0" layout_weight="1">
                  <horizontal>
                    <text text="视频停留时间（秒）" />
                    <input w="100" textSize="14" inputType="number" hint="大于x秒" id="daliy_videoSkipMin" text="{{storageDaliyConfig.videoSkipMin()}}" />
                    <text text=" - "></text>
                    <input w="100" textSize="14" inputType="number" hint="小于x秒" id="daliy_videoSkipMax" text="{{storageDaliyConfig.videoSkipMax()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="点赞条件数" />
                    <input w="100" textSize="14" inputType="number" hint="大于x赞" id="daliy_likeMin" text="{{storageDaliyConfig.likeMin()}}" />
                    <text text=" - "></text>
                    <input w="100" textSize="14" inputType="number" hint="小于x赞" id="daliy_likeMax" text="{{storageDaliyConfig.likeMax()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="收藏条件数" />
                    <input w="100" textSize="14" inputType="number" hint="大于x收藏" id="daliy_collectMin" text="{{storageDaliyConfig.collectMin()}}" />
                    <text text=" - "></text>
                    <input w="100" textSize="14" inputType="number" hint="小于x收藏" id="daliy_collectMax" text="{{storageDaliyConfig.collectMax()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="评论条件数" />
                    <input w="100" textSize="14" inputType="number" hint="大于x评论" id="daliy_commentMin" text="{{storageDaliyConfig.commentMin()}}" />
                    <text text=" - "></text>
                    <input w="100" textSize="14" inputType="number" hint="小于x评论" id="daliy_commentMax" text="{{storageDaliyConfig.commentMax()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="评论内容" />
                    <input w="*" textSize="14" inputType="textMultiLine" hint="每一个换行为一条评论" id="daliy_commentContent" text="{{storageDaliyConfig.commentContent()}}" />
                  </horizontal>
                </vertical>
              </horizontal>
            </card>
            <card w="*" h="*" margin="10 5" cardCornerRadius="2dp" cardElevation="1dp" foreground="?selectableItemBackground">
              <horizontal gravity="center_vertical">
                <View bg="#1495E7" h="*" w="5" />
                <vertical padding="10 8" h="auto" w="0" layout_weight="1">
                  <horizontal>
                    <text text="是否访问直播间" /><Switch id="daliy_isVisitLive" padding="8 8 8 8" textSize="12" checked="{{storageDaliyConfig.isVisitLive()}}"></Switch>
                  </horizontal>
                  <horizontal>
                    <text text="观看多少个直播间" />
                    <input w="*" textSize="14" inputType="number" hint="达到数量后会退出直播间" id="daliy_liveAmount" text="{{storageDaliyConfig.liveAmount()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="直播间人数区间" />
                    <input w="100" textSize="14" inputType="number" hint="小于x跳过" id="daliy_liveMinPersonAmount" text="{{storageDaliyConfig.liveMinPersonAmount()}}" />
                    <text text=" - "></text>
                    <input w="100" textSize="14" inputType="number" hint="大于x跳过" id="daliy_liveMaxPersonAmount" text="{{storageDaliyConfig.liveMaxPersonAmount()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="直播间停留时间（秒）" />
                    <input w="80" textSize="14" inputType="number" hint="大于x秒" id="daliy_liveSkipMin" text="{{storageDaliyConfig.liveSkipMin()}}" />
                    <text text=" - "></text>
                    <input w="80" textSize="14" inputType="number" hint="小于x秒" id="daliy_liveSkipMax" text="{{storageDaliyConfig.liveSkipMax()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="当日直播间关注人数上限" />
                    <input w="*" textSize="14" inputType="number" hint="超过则不继续关注，不填则不限制" id="daliy_dayLiveUserFocusLimit" text="{{storageDaliyConfig.dayLiveUserFocusLimit()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="直播间关注人数上限" />
                    <input w="*" textSize="14" inputType="number" hint="超过则不继续关注，不填则不限制" id="daliy_liveUserFocusLimit" text="{{storageDaliyConfig.liveUserFocusLimit()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="关注用户性别筛选" />
                    <radiogroup orientation="horizontal">
                      <radio id="daliy_liveUserGender0" text="全部" />
                      <radio id="daliy_liveUserGender1" text="男" />
                      <radio id="daliy_liveUserGender2" text="女" />
                    </radiogroup>
                  </horizontal>
                  <horizontal>
                    <text text="关注用户关注数筛选" />
                    <input w="80" textSize="14" inputType="number" hint="大于x关注" id="daliy_liveUserFocusMin" text="{{storageDaliyConfig.liveUserFocusMin()}}" />
                    <text text=" - "></text>
                    <input w="80" textSize="14" inputType="number" hint="小于x关注" id="daliy_liveUserFocusMax" text="{{storageDaliyConfig.liveUserFocusMax()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="关注用户粉丝数筛选" />
                    <input w="80" textSize="14" inputType="number" hint="大于x粉" id="daliy_liveUserFansMin" text="{{storageDaliyConfig.liveUserFansMin()}}" />
                    <text text=" - "></text>
                    <input w="80" textSize="14" inputType="number" hint="小于x粉" id="daliy_liveUserFansMax" text="{{storageDaliyConfig.liveUserFansMax()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="直播间关注用户地区筛选" />
                    <input w="*" textSize="14" inputType="text" hint="多个用,分割" id="daliy_liveUserArea" text="{{storageDaliyConfig.liveUserArea()}}" />
                  </horizontal>
                </vertical>
              </horizontal>
            </card>
            <vertical padding="5">
              <horizontal>
                <button w="*" id="startDouyinDaliyWork" style="Widget.AppCompat.Button.Colored" text="运行" />
              </horizontal>
            </vertical>
          </vertical>
        </ScrollView>
        {/* 抖音新号任务 */}
        <ScrollView>
          <vertical>
            <card w="*" h="*" margin="10 5" cardCornerRadius="2dp" cardElevation="1dp" foreground="?selectableItemBackground">
              <horizontal gravity="center_vertical">
                <View bg="#1495E7" h="*" w="5" />
                <vertical padding="10 8" h="auto" w="0" layout_weight="1">
                  <horizontal padding="0 5"><text text="[当前脚本版本]" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="{{app.versionName}}" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="[支持版本]" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="抖音 version{{fillAppVersion}}" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="[支持版本APK下载地址]" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text autoLink="all" text="https://www.wandoujia.com/apps/7461948/history_v300101" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="[功能说明] " textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="退出脚本：点击音量上即可退出脚本" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text id="title" text="[任务介绍] " textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text id="title" text="进入抖音首页，点击搜索“找工作”，点击“视频”菜单，选择“广州”，点击第一个视频进行观看15-30s，保持持续下滑观看，设置点赞评论收藏量，设置点赞条件（少于多少赞），设置评论条件（少于多少评论），设置评论内容，设置收藏条件（少于多少收藏）" textSize="13sp" /></horizontal>
                </vertical>
              </horizontal>
            </card>
            <card w="*" h="*" margin="10" cardCornerRadius="2dp" cardElevation="1dp" foreground="?selectableItemBackground">
              <horizontal gravity="center_vertical">
                <View bg="#1495E7" h="*" w="5" />
                <vertical padding="10 8" h="auto" w="0" layout_weight="1">
                  <horizontal>
                    <text text="搜索关键词" />
                    <input w="*" textSize="14" inputType="text" hint="" id="new_searchContent" text="{{storageNewConfig.searchContent()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="进入视频分类" />
                    <input w="*" textSize="14" inputType="text" hint="" id="new_videoClassify" text="{{storageNewConfig.videoClassify()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="视频停留时间（秒）" />
                    <input w="100" textSize="14" inputType="number" hint="大于x秒" id="new_videoSkipMin" text="{{storageNewConfig.videoSkipMin()}}" />
                    <text text=" - "></text>
                    <input w="100" textSize="14" inputType="number" hint="小于x秒" id="new_videoSkipMax" text="{{storageNewConfig.videoSkipMax()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="点赞条件数" />
                    <input w="100" textSize="14" inputType="number" hint="大于x赞" id="new_likeMin" text="{{storageNewConfig.likeMin()}}" />
                    <text text=" - "></text>
                    <input w="100" textSize="14" inputType="number" hint="小于x赞" id="new_likeMax" text="{{storageNewConfig.likeMax()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="收藏条件数" />
                    <input w="100" textSize="14" inputType="number" hint="大于x收藏" id="new_collectMin" text="{{storageNewConfig.collectMin()}}" />
                    <text text=" - "></text>
                    <input w="100" textSize="14" inputType="number" hint="小于x收藏" id="new_collectMax" text="{{storageNewConfig.collectMax()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="评论条件数" />
                    <input w="100" textSize="14" inputType="number" hint="大于x评论" id="new_commentMin" text="{{storageNewConfig.commentMin()}}" />
                    <text text=" - "></text>
                    <input w="100" textSize="14" inputType="number" hint="小于x评论" id="new_commentMax" text="{{storageNewConfig.commentMax()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="评论内容" />
                    <input w="*" textSize="14" inputType="textMultiLine" hint="每一个换行为一条评论" id="new_commentContent" text="{{storageNewConfig.commentContent()}}" />
                  </horizontal>
                  {/* <horizontal><text text="运行模式" /><spinner id="new_model" entries="播放界面运行|搜索运行|播放喜欢的音乐|指定歌单" ></spinner></horizontal> */}
                </vertical>
              </horizontal>
            </card>
            <vertical padding="5">
              <horizontal>
                <button w="*" id="startDouyinNewWork" style="Widget.AppCompat.Button.Colored" text="运行" />
              </horizontal>
            </vertical>
          </vertical>
        </ScrollView>
        {/* 快手养号任务 */}
        <ScrollView>
          <vertical>
            <card w="*" h="*" margin="10 5" cardCornerRadius="2dp" cardElevation="1dp" foreground="?selectableItemBackground">
              <horizontal gravity="center_vertical">
                <View bg="#1495E7" h="*" w="5" />
                <vertical padding="10 8" h="auto" w="0" layout_weight="1">
                  <horizontal padding="0 5"><text text="[当前脚本版本]" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="{{app.versionName}}" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="[支持版本]" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="快手 V{{fillKsAppVersion}}" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="[支持版本APK下载地址]" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text autoLink="all" text="https://www.wandoujia.com/apps/280621/history_v28058?spm=aligames_platform_ug.wdj_seo.0.0.64e342746LQPbg" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="[功能说明] " textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="退出脚本：点击音量上即可退出脚本" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="[任务介绍] " textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="进入快手app-跳过广告-进入首页-点击搜素-输入招聘-选择直播-进入直播间-点击用户-点击关注" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text id="title" text="[数据展示]" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text id="title" text="当日直播间已关注人数：{{storageKsYanghaoConfig.dayLiveUserFocusAmount()}}" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text id="title" text="脚本最后运行时间：{{dayjs(storageKsYanghaoConfig.lastRunTime()).format('YYYY-MM-DD HH:mm:ss')}}" textSize="13sp" /></horizontal>
                </vertical>
              </horizontal>
            </card>
            <card w="*" h="*" margin="10 5" cardCornerRadius="2dp" cardElevation="1dp" foreground="?selectableItemBackground">
              <horizontal gravity="center_vertical">
                <View bg="#1495E7" h="*" w="5" />
                <vertical padding="10 8" h="auto" w="0" layout_weight="1">
                  <horizontal>
                    <text text="搜索关键词" />
                    <input w="*" textSize="14" inputType="text" hint="" id="ksYanghao_searchContent" text="{{storageKsYanghaoConfig.searchContent()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="观看多少个直播间" />
                    <input w="*" textSize="14" inputType="number" hint="达到数量后会退出直播间" id="ksYanghao_liveAmount" text="{{storageKsYanghaoConfig.liveAmount()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="直播间人数区间" />
                    <input w="100" textSize="14" inputType="number" hint="小于x跳过" id="ksYanghao_liveMinPersonAmount" text="{{storageKsYanghaoConfig.liveMinPersonAmount()}}" />
                    <text text=" - "></text>
                    <input w="100" textSize="14" inputType="number" hint="大于x跳过" id="ksYanghao_liveMaxPersonAmount" text="{{storageKsYanghaoConfig.liveMaxPersonAmount()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="直播间停留时间（秒）" />
                    <input w="80" textSize="14" inputType="number" hint="大于x秒" id="ksYanghao_liveSkipMin" text="{{storageKsYanghaoConfig.liveSkipMin()}}" />
                    <text text=" - "></text>
                    <input w="80" textSize="14" inputType="number" hint="小于x秒" id="ksYanghao_liveSkipMax" text="{{storageKsYanghaoConfig.liveSkipMax()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="当日直播间关注人数上限" />
                    <input w="*" textSize="14" inputType="number" hint="超过则不继续关注，不填则不限制" id="ksYanghao_dayLiveUserFocusLimit" text="{{storageKsYanghaoConfig.dayLiveUserFocusLimit()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="直播间关注人数上限" />
                    <input w="*" textSize="14" inputType="number" hint="超过则不继续关注，不填则不限制" id="ksYanghao_liveUserFocusLimit" text="{{storageKsYanghaoConfig.liveUserFocusLimit()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="关注用户关注数筛选" />
                    <input w="80" textSize="14" inputType="number" hint="大于x关注" id="ksYanghao_liveUserFocusMin" text="{{storageKsYanghaoConfig.liveUserFocusMin()}}" />
                    <text text=" - "></text>
                    <input w="80" textSize="14" inputType="number" hint="小于x关注" id="ksYanghao_liveUserFocusMax" text="{{storageKsYanghaoConfig.liveUserFocusMax()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="关注用户粉丝数筛选" />
                    <input w="80" textSize="14" inputType="number" hint="大于x粉" id="ksYanghao_liveUserFansMin" text="{{storageKsYanghaoConfig.liveUserFansMin()}}" />
                    <text text=" - "></text>
                    <input w="80" textSize="14" inputType="number" hint="小于x粉" id="ksYanghao_liveUserFansMax" text="{{storageKsYanghaoConfig.liveUserFansMax()}}" />
                  </horizontal>
                  {/* <horizontal>
                    <text text="直播间关注用户地区筛选" />
                    <input w="*" textSize="14" inputType="text" hint="多个用,分割" id="ksYanghao_liveUserArea" text="{{storageKsYanghaoConfig.liveUserArea()}}" />
                  </horizontal> */}
                </vertical>
              </horizontal>
            </card>
            <vertical padding="5">
              <horizontal>
                <button w="*" id="startKsYanghaoWork" style="Widget.AppCompat.Button.Colored" text="运行" />
              </horizontal>
            </vertical>
          </vertical>
        </ScrollView>
        {/* 直播间关注 */}
        <ScrollView>
          <vertical>
            <card w="*" h="*" margin="10 5" cardCornerRadius="2dp" cardElevation="1dp" foreground="?selectableItemBackground">
              <horizontal gravity="center_vertical">
                <View bg="#E74C3C" h="*" w="5" />
                <vertical padding="10 8" h="auto" w="0" layout_weight="1">
                  <horizontal padding="0 5"><text text="[功能说明]" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="进入直播间 → 打开在线观众列表 → 筛选男性用户 → 逐个关注 → 滑到下一个直播间循环执行" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="[退出方式]" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="点击音量上键即可退出脚本" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text text="[数据展示]" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text id="title" text="当日已关注人数：{{followerConfig.dayFollowedAmount()}}" textSize="13sp" /></horizontal>
                  <horizontal padding="0 5"><text id="title" text="脚本最后运行时间：{{dayjs(followerConfig.lastRunTime()).format('YYYY-MM-DD HH:mm:ss')}}" textSize="13sp" /></horizontal>
                </vertical>
              </horizontal>
            </card>
            <card w="*" h="*" margin="10 5" cardCornerRadius="2dp" cardElevation="1dp" foreground="?selectableItemBackground">
              <horizontal gravity="center_vertical">
                <View bg="#E74C3C" h="*" w="5" />
                <vertical padding="10 8" h="auto" w="0" layout_weight="1">
                  <horizontal>
                    <text text="关注最小间隔（毫秒）" />
                    <input w="100" textSize="14" inputType="number" hint="默认3000" id="follower_followMinDelay" text="{{followerConfig.followMinDelay()}}" />
                    <text text="  -  "></text>
                    <input w="100" textSize="14" inputType="number" hint="默认8000" id="follower_followMaxDelay" text="{{followerConfig.followMaxDelay()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="点击最小偏移（像素）" />
                    <input w="100" textSize="14" inputType="number" hint="默认5" id="follower_tapOffsetMin" text="{{followerConfig.tapOffsetMin()}}" />
                    <text text="  -  "></text>
                    <input w="100" textSize="14" inputType="number" hint="默认30" id="follower_tapOffsetMax" text="{{followerConfig.tapOffsetMax()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="单次执行关注上限" />
                    <input w="*" textSize="14" inputType="number" hint="默认20" id="follower_sessionFollowLimit" text="{{followerConfig.sessionFollowLimit()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="单日关注上限" />
                    <input w="*" textSize="14" inputType="number" hint="默认80" id="follower_dayFollowLimit" text="{{followerConfig.dayFollowLimit()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="每个直播间滚动次数" />
                    <input w="*" textSize="14" inputType="number" hint="默认3次" id="follower_maxScrollsPerRoom" text="{{followerConfig.maxScrollsPerRoom()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="关注概率（0-1）" />
                    <input w="*" textSize="14" inputType="number" hint="默认0.9" id="follower_followProbability" text="{{followerConfig.followProbability()}}" />
                  </horizontal>
                  <horizontal>
                    <text text="仅关注男性用户" /><Switch id="follower_followMaleOnly" padding="8 8 8 8" textSize="12" checked="{{followerConfig.followMaleOnly()}}"></Switch>
                  </horizontal>
                  <horizontal>
                    <text text="详细日志模式" /><Switch id="follower_debugMode" padding="8 8 8 8" textSize="12" checked="{{followerConfig.debugMode()}}"></Switch>
                  </horizontal>
                </vertical>
              </horizontal>
            </card>
            <vertical padding="5">
              <horizontal>
                <button w="*" id="startLiveRoomFollower" style="Widget.AppCompat.Button.Colored" text="运行" bg="#E74C3C" />
              </horizontal>
            </vertical>
          </vertical>
        </ScrollView>
      </viewpager>
    </vertical>
  </frame>
)
// 检测抖音版本是否与脚本适配版本匹配
function checkDouyinVersion () {
  const nowAppVersion = Utils.getVerName(app.getPackageName("抖音"))
  log("抖音当前版本号：", nowAppVersion)
  if (nowAppVersion != fillAppVersion) {
    toastLog("当前您的抖音版本与脚本不适配，请下载对应适配的版本")
    isFillVer = false
  }
}
// 检测快手版本是否与脚本适配版本匹配
function checkKsVersion () {
  const nowAppVersion = Utils.getVerName(app.getPackageName("快手"))
  log("快手当前版本号：", nowAppVersion)
  if (nowAppVersion != fillKsAppVersion) {
    toastLog("当前您的快手版本与脚本不适配，请下载对应适配的版本")
    isFillKsVer = false
  }
}

// 检测当前版本是否适配
const checkVersionThreads = threads.start((() => {
  checkDouyinVersion()
  checkKsVersion()
  checkVersionThreads.interrupt()
}))

// tabs页
ui.viewpager.setTitles(["抖音每日任务", "抖音新号任务", "快手养号任务", "直播间关注"])
ui.tabs.setupWithViewPager(ui.viewpager)


// 抖音每日任务
// 用户性别筛选 radio
ui.daliy_liveUserGender0.setChecked(true)
ui.startDouyinDaliyWork.on("click", function () {
  auto.waitFor(); // 等待无障碍服务启动

  const startMain = function () {
    storageDaliyConfig.saveConfig()

    // 记录该脚本最后运行时间
    storageDaliyConfig.storageDaliy.put('lastRunTime', new Date().getTime())

    threads.start(function () {
      startDouyinDaliyWork()
    })
  }

  if (!isFillVer) {
    confirm("当前您的抖音版本与脚本不适配，可能无法正常进行，请确认继续运行？")
      .then(res => {
        if (res) {
          startMain()
        }
      })
    return
  }

  startMain()
})
// 抖音每日任务 End

// 抖音新号任务
ui.startDouyinNewWork.on("click", function () {
  auto.waitFor(); // 等待无障碍服务启动

  const startMain = function () {
    storageNewConfig.saveConfig()
    threads.start(function () {
      startDouyinNewWork()
    })
  }

  if (!isFillVer) {
    confirm("当前您的抖音版本与脚本不适配，可能无法正常进行，请确认继续运行？")
      .then(res => {
        if (res) {
          startMain()
        }
      })
    return
  }

  startMain()
})
// 抖音新号任务 END

// 快手养号任务
ui.startKsYanghaoWork.on("click", function () {
  auto.waitFor(); // 等待无障碍服务启动

  const startMain = function () {
    storageKsYanghaoConfig.saveConfig()

    // 记录该脚本最后运行时间
    storageKsYanghaoConfig.storagesKsYanghao.put('lastRunTime', new Date().getTime())

    threads.start(function () {
      startKsYanghaoWork()
    })
  }

  if (!isFillKsVer) {
    confirm("当前您的快手版本与脚本不适配，可能无法正常进行，请确认继续运行？")
      .then(res => {
        if (res) {
          startMain()
        }
      })
    return
  }

  startMain()
})
// 快手养号任务 END

// 直播间关注
ui.startLiveRoomFollower.on("click", function () {
  auto.waitFor(); // 等待无障碍服务启动

  const startMain = function () {
    followerConfig.saveConfig()

    // 记录该脚本最后运行时间
    followerConfig.updateLastRunTime()

    threads.start(function () {
      startLiveRoomFollower()
    })
  }

  if (!isFillVer) {
    confirm("当前您的抖音版本与脚本不适配，可能无法正常进行，请确认继续运行？")
      .then(res => {
        if (res) {
          startMain()
        }
      })
    return
  }

  startMain()
})
// 直播间关注 END

let clickCount = 0
let timeout = null
ui.toolbar.on("click", function () {
  // 连续点击6下则出现日志界面
  clickCount++
  timeout && clearTimeout(timeout)

  timeout = setTimeout(() => {
    clickCount = 0
  }, 2000);
  
  if (clickCount >= 6) {
    app.startActivity("console");
    clickCount = 0
  }
})

// ========= 调试 =========
// threads.start(function () {
//   startDouyinDaliyWork()
// })
// ========= 调试 =========