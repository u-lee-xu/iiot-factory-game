// ═══════════════════════════════════════════════════════════════════════
// 学生端主业务（原 student.html 主 script 迁出）
// ES Module：见 docs/架构设计.md
// ═══════════════════════════════════════════════════════════════════════
// BLOCK INDEX
// ═══════════════════════════════════════════════════════════════════════

import { escHtml, dstr, _fmtTime, starStr, taskKey, taskXP } from './core/utils.js';
import { setupGlobalEnter } from './core/kbd.js';
import { renderFactory } from './ui/main.js';
import { selectLevel } from './ui/main.js';
import { renderMission } from './ui/main.js';
import { openTaskModal } from './ui/main.js';
import { closeModal } from './ui/main.js';
import { closeTaskModal } from './ui/main.js';
import { findTaskAnswer } from './ui/main.js';
import { showTaskHintPopup } from './ui/main.js';
import { useTaskHint } from './ui/main.js';
import { useTaskPass } from './ui/main.js';
import { addTaskItemBar } from './ui/main.js';
import { completeTask } from './ui/main.js';
import { toggleTask } from './ui/main.js';
import { finishTaskFlow } from './ui/main.js';
import { renderTypeTerminal } from './ui/main.js';
import { getLevelTasks } from './core/state.js';
import { isTaskDone } from './core/state.js';
import { calcTotalXP } from './core/state.js';
import { getRank } from './core/state.js';
import { levelProgress } from './core/state.js';
import { areaStars } from './core/state.js';
import { api } from './core/api.js';
import { loadGameContent } from './core/api.js';
import { loadKnowledgeTags } from './core/api.js';
import { loadState } from './core/api.js';
import { saveState } from './core/api.js';
import { typewrite } from './core/fx.js';
import { generateTeach } from './core/fx.js';
import { getRandomMoodLine } from './core/fx.js';
import { getDirectorMood } from './core/fx.js';
import { addDirectorBox } from './core/fx.js';
import { shakeScreen } from './core/fx.js';
import { glowCorrect } from './core/fx.js';
import { renderHeader } from './ui/header.js';
import { updateDirectorAvatar } from './ui/header.js';
import { getGameStats } from './ui/achievements.js';
import { saveGameStats } from './ui/achievements.js';
import { bumpGameStats } from './ui/achievements.js';
import { miniTier } from './ui/achievements.js';
import { miniMarkClear } from './ui/achievements.js';
import { miniTierBadge } from './ui/achievements.js';
import { applyMiniTier } from './ui/achievements.js';
import { focusResultPrimary } from './ui/achievements.js';
import { recordGameWin } from './ui/achievements.js';
import { achievementContext } from './ui/achievements.js';
import { evaluateAchievements } from './ui/achievements.js';
import { markPopupToday } from './ui/achievements.js';
import { enqueueLoginPopup } from './ui/achievements.js';
import { drainLoginPopups } from './ui/achievements.js';
import { enqueueAchievementsJob } from './ui/achievements.js';
import { drainAchQueue } from './ui/achievements.js';
import { getSeenAch } from './ui/achievements.js';
import { setSeenAch } from './ui/achievements.js';
import { detectNewServerAchievements } from './ui/achievements.js';
import { showAchievementUnlock } from './ui/achievements.js';
import { renderAchBar } from './ui/achievements.js';
import { checkLevelUp } from './ui/modals.js';
import { showLevelUp } from './ui/modals.js';
import { showWelcomeDialog } from './ui/modals.js';
import { showLevelIntro } from './ui/modals.js';
import { showLevelComplete } from './ui/modals.js';
import { tutSeen } from './ui/tutorial.js';
import { tutMark } from './ui/tutorial.js';
import { showGameTutorial } from './ui/tutorial.js';
import { showTypingTutorial } from './ui/tutorial.js';
import { showShooterLoadout } from './ui/tutorial.js';
import { loadTermCards } from './ui/gamezone.js';
import { getTermLevel } from './ui/gamezone.js';
import { termWarmupDone } from './ui/gamezone.js';
import { markTermWarmupDone } from './ui/gamezone.js';
import { countUnlockedGameTypes } from './ui/gamezone.js';
import { gzEmoji } from './ui/gamezone.js';
import { gzMeta } from './ui/gamezone.js';
import { gzName } from './ui/gamezone.js';
import { renderGameZone } from './ui/gamezone.js';
import { gzPlay } from './ui/gamezone.js';
import { isUnlocked } from './ui/gamezone.js';
import { refreshGameZone } from './ui/gamezone.js';
import { gzAfter } from './ui/gamezone.js';
import { buildGameZone } from './ui/gamezone.js';
import { openGameZone } from './ui/gamezone.js';
import { closeGameZone } from './ui/gamezone.js';
import { openGameRoom } from './ui/gamezone.js';
import { closeGameRoom } from './ui/gamezone.js';
import { gzOpenType } from './ui/gamezone.js';
import { renderGameRoom } from './ui/gamezone.js';
import { buildGameRoom } from './ui/gamezone.js';
import { loadShop } from './ui/wallet.js';
import { walletRank } from './ui/wallet.js';
import { buildWallet } from './ui/wallet.js';
import { openWallet } from './ui/wallet.js';
import { closeWallet } from './ui/wallet.js';
import { renderWallet } from './ui/wallet.js';
import { claimSalaryNow } from './ui/wallet.js';
import { buyItem } from './ui/wallet.js';
import { getEquippedSkin } from './ui/wallet.js';
import { equippedEnemySkin } from './ui/wallet.js';
import { equipSkin } from './ui/wallet.js';
import { refreshLeaderboard } from './ui/leaderboard.js';
import { openGameRecords } from './ui/leaderboard.js';
import { closeGameRecords } from './ui/leaderboard.js';
import { renderGameRecords } from './ui/leaderboard.js';
import { openLeaderboard } from './ui/leaderboard.js';
import { openAchievements } from './ui/leaderboard.js';
import { closeLb } from './ui/leaderboard.js';
import { switchLbTab } from './ui/leaderboard.js';
import { renderLeaderboard } from './ui/leaderboard.js';
import { renderAchievements } from './ui/leaderboard.js';
import { openPasswordModal } from './ui/password.js';
import { closePasswordModal } from './ui/password.js';
import { savePassword } from './ui/password.js';
import { showPasswordPrompt } from './ui/password.js';
import { getPedia } from './ui/pedia.js';
import { savePedia } from './ui/pedia.js';
import { getPediaCount } from './ui/pedia.js';
import { unlockPedia } from './ui/pedia.js';
import { pediaCount } from './ui/pedia.js';
import { openPedia } from './ui/pedia.js';
import { closePedia } from './ui/pedia.js';
import { renderPedia } from './ui/pedia.js';
import { interactions, registerInteraction, getInteraction, miniGames, registerMiniGame } from './core/interactions.js';
import './interactions/terminal.js';
import './interactions/quiz.js';
import './interactions/chain_quiz.js';
import './interactions/fill_blank.js';
import './interactions/progress_bar.js';
import './interactions/install_wizard.js';
import './interactions/scenario_match.js';
import './interactions/sort.js';
import './interactions/code_review.js';
import './interactions/ethics.js';
import './interactions/diagnosis_tree.js';
import './interactions/drag_classify.js';
import './interactions/boss_fight.js';
import './interactions/config_debug.js';
import './interactions/log_forensics.js';
import './interactions/default.js';
import { getAudioCtx, toggleSound, getMusicSong, playMusic, toggleMusic, nextMusic, playSound, loadMusicPref, ensureMusicPlayback, BG_TRACKS, bgIdx, soundEnabled, audioCtx, musicEnabled, currentTrack, musicGainNode, musicSrc } from './core/sound.js';
import { openPacman } from './games/pacman.js';
import { openHacknet } from './games/hack.js';
import { openTycoon } from './games/tyc.js';
import { openLaser } from './games/lzr.js';
import { openBoss } from './games/boss.js';
import { openMemoryMatch } from './games/memory.js';
import { openStackedMatch } from './games/stacked.js';
import { openMatchGame } from './games/match.js';
import { openQuickMatch } from './games/quick.js';
import { openStormDefense } from './games/storm.js';
import { openAlarmRush } from './games/alarm.js';
import { openTypingDefense } from './games/typing.js';
import { openShooter } from './games/shooter.js';
import { openSorter } from './games/sorter.js';
import { openForge } from './games/forge.js';
import { openLianLian } from './games/ll.js';
import { openPipe } from './games/pipe.js';
import { openMatch3 } from './games/m3.js';
import { openTowerDefense } from './games/td.js';
import { openTile2048 } from './games/t48.js';
import { openMaze } from './games/maze.js';
import { openFlappy } from './games/flappy.js';
import { openMole } from './games/mole.js';
import { openSnake } from './games/snake.js';
import { openBreakout } from './games/breakout.js';
import { openTank } from './games/tank.js';
import { openDataRacing } from './games/racing.js';
// 弹窗每日标记（依赖 utils 的 dstr）
function popupShownToday(t){ try{ return localStorage.getItem('popup_day_'+t)===dstr(); }catch(e){ return false; } }


//  547: 1. CONFIG & STATE       — API 封装、全局变量、session
//  673: 2. SOUND SYSTEM         — AudioContext、toggleSound、playSound
//  695: 3. ANIMATION            — typewrite 打字机效果、frame 动画
//  817: 4. TEACH TEXT           — generateTeach() 厂长教学文案生成
//  820: 5. DIRECTOR BOX         — addDirectorBox() 厂长气泡+折叠
//  855: 6. UI FX                — shakeScreen()、glowCorrect()
//  872: 7. INTERACT REGISTRY    — registerInteraction()、getInteraction()
//  921: 8. XP & PROGRESS        — getLevelTasks、taskXP、calcTotalXP、rank
// 1010: 9. FACTORY RENDER       — renderFactory() 绘制关卡网格
// 1065: 10. LEVEL & MISSION     — selectLevel()、renderMission()
// 1134: 11. TASK MODAL          — openTaskModal()、closeModal()、completeTask()
// 1194: 12. interact: terminal  — 交互式终端模拟
// 1481: 13. interact: quiz      — 选择题
// 1537: 14. interact: chain_quiz — 连环答题
// 1617: 15. interact: fill_blank — 填空选择
// 1664: 16. interact: progress_bar — 安装进度条
// 1715: 17. interact: install_wizard — 安装向导
// 1981: 18. interact: scenario_match — 场景匹配
// 2056: 19. interact: sort — 拖拽排序
// 2144: 20. interact: code_review — 代码审查
// 2198: 21. interact: ethics — 伦理决策
// 2245: 22. interact: diagnosis_tree — 诊断树
// 2301: 23. interact: drag_classify — 拖拽分类
// 2406: 24. interact: boss_fight — Boss 战
// 2511: 25. interact: config_debug — 配置排障
// 2634: 26. interact: log_forensics — 日志溯源
// 2750: 27. interact: default — 兜底渲染
// 2768: 28. COMMON UI — renderHeader、showToast、logout、checkLevelUp
// ═══════════════════════════════════════════════════════════════════════

// =========================================================================
// 1. CONFIG & STATE
// =========================================================================
const API = location.origin;

// 学生密码开关（后端 PASSWORD_ENABLED 环境变量；/api/student/me 返回后联动覆盖）
let PASSWORD_ENABLED = true;
const token = sessionStorage.getItem('token');
const role = sessionStorage.getItem('role');
const myName = sessionStorage.getItem('name');

if (!token || role !== 'student') { location.href = 'index.html'; }

const RANKS = [
  { min: 0, title: '实习生', emoji: '🔰' },
  { min: 1000, title: '学徒', emoji: '🔧' },
  { min: 2500, title: '技工', emoji: '⚙️' },
  { min: 4500, title: '工程师', emoji: '🛠️' },
  { min: 7000, title: '专家', emoji: '🏆' }
];

let content = null;       // game content from API
let gameState = { check: {}, stars: {}, achievements: {}, teacherAwards: {}, hasPassword: false, newlyAwardedLogin: [] };
// 交互统计变量（部分交互复用同一组计数，需全局兜底，避免 ReferenceError）
let errors = 0;
let streak = 0;
let leaderboardCache = null;
let achQueue = [];
let lbTab = 'rank';
let currentLevelId = 1;
let currentTaskId = null;
// ===== 区域(幕)背景音乐 & 按幕选小游戏配乐 =====
let currentAreaKey = 'hub';
function setArea(lvId) {
  const lv = content && content.levels.find(l => l.id === lvId);
  currentAreaKey = (lv && lv.factoryArea) || 'hub';
}
function playAreaMusic() { playMusic(currentAreaKey || 'hub'); }
// 按「幕 + 游戏类型」选小游戏配乐，缺省降级：类型_幕 → 类型 → match
function gameSong(type) {
  const k = type + '_L' + currentLevelId;
  if (window.MUSIC_SONGS && window.MUSIC_SONGS[k]) return k;
  // 新玩法默认配曲（可覆盖）
  const MAP = { sorter:'alarm', forge:'boss', ll:'match', pipe:'console', m3:'quick', td:'alarm', t48:'quick', maze:'workshop', hack:'console', tyc:'workshop', lzr:'match', boss:'boss' };
  const mapped = MAP[type];
  if (mapped && window.MUSIC_SONGS && window.MUSIC_SONGS[mapped]) return mapped;
  const fb = type === 'memory' ? 'match' : type;
  if (window.MUSIC_SONGS && window.MUSIC_SONGS[fb]) return fb;
  return 'match';
}

// =========================================================================
// 2c. TEACH TEXT GENERATOR
// =========================================================================

// =========================================================================
// 2d. DIRECTOR DIALOGUE
// =========================================================================

// =========================================================================
// 2c. DIRECTOR MOOD SYSTEM (厂长情绪系统)
// =========================================================================
var directorMoodLines = {
  proud: [      // 😎 得意/赞赏 - 连续通过、0失误、解锁隐藏
    "漂亮！这波操作教科书级别",
    "不愧是我看好的人，稳！",
    "这手速、这准度，有前途",
    "厂里就缺你这种干实事的",
    "完美通过，工位升级已安排上"
  ],
  stern: [      // 😤 严肃/催促 - 连续报错、超时、用了hint还错
    "别急，先看清提示再输",
    "心静不下来，命令输不对",
    "车间设备不等人，重新来过",
    "基础不牢，地动山摇啊",
    "再仔细看一遍厂长说的"
  ],
  awkward: [    // 😅 尴尬/吐槽 - 输错关卡类型的命令、输无关命令
    "兄弟，这是装 SSH 的关卡不是查目录…",
    "命令输对了，但关卡搞错了呀",
    "你这是在给服务器按摩吗？",
    "厂长看着你乱输挺心累的",
    "建议先收起教学再动手"
  ],
  guide: [     // 👨‍💼 开场导语 - 首次进关卡，厂长先讲方法再动手
    "先听厂长把方法讲清楚，再动手不迟",
    "这个任务的重点，厂长先给你划出来",
    "跟紧厂长，一步一个脚印",
    "记住要点，后面全靠它"
  ],
  thinking: [   // 🤔 思考/提示 - 请求hint、收起教学后（首次进关卡走 guide 导语）
    "卡住了？看看上面的提示栏",
    "第一步通常是最关键的",
    "不用急，厂长给你留着灯",
    "回想一下上一关咋过的"
  ],
  neutral: [    // 默认/兜底
    "厂长把这个任务交给你了",
    "机器不会等——赶紧处理",
    "按部就班来，稳住"
  ]
};





// =========================================================================
// 2d. SCREEN EFFECTS
// =========================================================================


// =========================================================================
// 2. INTERACTION REGISTRY (plugin system)
// =========================================================================

// =========================================================================
// 3. API HELPERS
// =========================================================================


// Knowledge tags lookup
window.KNOWLEDGE_TAGS = {};
loadKnowledgeTags();

// =========================================================================
// 4. STATE MANAGEMENT
// =========================================================================


// =========================================================================
// 5. COMPUTED
// =========================================================================









// =========================================================================
// 6. RENDER: FACTORY VIEW
// =========================================================================

// =========================================================================
// 7. RENDER: MISSION PANEL
// =========================================================================


// =========================================================================
// 8. TASK INTERACTION SYSTEM
// =========================================================================
// 自带讲解的类型（内部已调用generateTeach + addDirectorBox）
var selfTeachTypes = ['terminal', 'quiz', 'chain_quiz', 'fill_blank', 'drag_classify', 'install_wizard', 'progress_bar'];


/* 右上角 ✕：叉掉任务。若从厂区地图进入任务，则带过场返回厂区（autoLogin 凭 mapRoom 自动重开刚才的房间），不再停留空白过渡页 */

window.__closeOverlay = function(el){ var o = el.closest('.mm-overlay'); if (o) o.remove(); };


// =========================================================================
// 8a. INTERACTION: TERMINAL (OVERHAULED - Real Terminal Feel)
// =========================================================================

// =========================================================================
// 8b. INTERACTION: QUIZ
// =========================================================================

// =========================================================================
// 9b. 工资 & 商城（钱包）
// =========================================================================
let SHOP_CACHE = null;
// ===== 皮肤系统 =====
const PLANE_SKINS = {
  default:      { name:'翠绿战机', col:'#00e676', ck:'#aaffcc' },
  plane_skin:   { name:'黄金战机', col:'#ffb300', ck:'#ffe9a8' },
  plane_red:    { name:'烈焰红',   col:'#ff5252', ck:'#ffd0d0' },
  plane_blue:   { name:'冰晶蓝',   col:'#40c4ff', ck:'#d6f5ff' },
  plane_purple: { name:'紫电',     col:'#b388ff', ck:'#ecdfff' },
  plane_neon:   { name:'霓虹',     col:'#ff6ec7', ck:'#ffe0f3' }
};
const ENEMY_SKIN_COLORS = {
  default:      { name:'网络蓝', col:'#00bcd4' },
  enemy_night:  { name:'夜战迷彩', col:'#5c6bc0' },
  enemy_matrix: { name:'矩阵绿', col:'#00c853' },
  enemy_lava:   { name:'岩浆橙', col:'#ff7043' },
  enemy_ice:    { name:'寒冰蓝', col:'#4fc3f7' },
  enemy_void:   { name:'紫雾', col:'#ab6cff' }
};
// 蛇皮肤：style 决定画风（smooth=朴素等粗线 / bamboo=竹节 / comet=彗星拖尾），col/dark/glow 为配色
const SNAKE_SKINS = {
  // —— smooth：一根等粗线，蛇头深色 ——
  default:       { name:'网线青绿', col:'#8cff5e', dark:'#1fa84f', belly:'#b9f6a5', glow:'#00e676', style:'smooth' },
  snake_gold:    { name:'黄金',     col:'#ffd54f', dark:'#c58a00', belly:'#ffe9b0', glow:'#ffb300', style:'smooth' },
  snake_ember:   { name:'熔岩橙',   col:'#ff8a50', dark:'#c23500', belly:'#ffd2b3', glow:'#ff5722', style:'smooth' },
  snake_ice:     { name:'冰晶蓝',   col:'#6ed7ff', dark:'#1f8fc2', belly:'#c8f0ff', glow:'#40c4ff', style:'smooth' },
  snake_void:    { name:'紫晶',     col:'#c79bff', dark:'#7c3fd0', belly:'#e6d4ff', glow:'#b388ff', style:'smooth' },
  snake_neon:    { name:'霓虹粉',   col:'#ff7ad9', dark:'#c2185b', belly:'#ffd9f0', glow:'#ff6ec7', style:'smooth' },
  snake_coal:    { name:'暗夜黑',   col:'#9ea7b3', dark:'#3d454f', belly:'#d0d6de', glow:'#58d0ff', style:'smooth' },
  snake_mint:    { name:'薄荷',     col:'#7df5c1', dark:'#1fa36a', belly:'#d0ffea', glow:'#2ce0a4', style:'smooth' },
  snake_sakura:  { name:'樱花',     col:'#ffa8c8', dark:'#d24b78', belly:'#ffe3ee', glow:'#ff8fb3', style:'smooth' },
  // —— bamboo：一节节圆球竹节 ——
  snake_bamboo:      { name:'竹节青',   col:'#7ccd4f', dark:'#3e7a2a', belly:'#d4e8b8', glow:'#9cef66', style:'bamboo' },
  snake_bamboo_tea:  { name:'竹节茶',   col:'#c8b06a', dark:'#7a6230', belly:'#e8dcc0', glow:'#e2cf8a', style:'bamboo' },
  snake_bamboo_purple:{ name:'竹节紫',  col:'#b08fe0', dark:'#6a46a8', belly:'#e2d4f5', glow:'#cdb4ff', style:'bamboo' },
  // —— comet：发光彗星拖尾 ——
  snake_comet:   { name:'彗星蓝',   col:'#7be3ff', dark:'#1f7ea8', belly:'#d0f3ff', glow:'#66e0ff', style:'comet' },
  snake_comet_pink:{ name:'彗星粉', col:'#ff9fe0', dark:'#b04a8f', belly:'#ffe0f3', glow:'#ff8fd8', style:'comet' },
  snake_comet_green:{ name:'彗星绿',col:'#8ff7a0', dark:'#2e9c4c', belly:'#d9ffdf', glow:'#5df28a', style:'comet' }
};

// Director mini-avatar mood sync
let directorMood = 'neutral';

// =========================================================================
// 9b. LEADERBOARD & ACHIEVEMENTS
// =========================================================================

const ACHIEVEMENTS = window.ACHIEVEMENTS || [];

// 小游戏表现统计（localStorage，本地记录）
// ===== 小游戏周目：通关次数 → 二周目(加难) / 三周目(无限战) =====

// 小游戏完成：+1 完成数（按类型/关卡累计）并触发成就判定
// type: 'mm'(翻牌) | 'qk'(快打) | 'match'(连线) | 'other'
// =========================================================================
// 9f. TYPING DEFENSE — 术语防御战（打字炮台）
// 关键词从上往下掉，底部炮台。输入完整命令→炮台发射打爆关键词；输错重新开始。
// =========================================================================
// 命令 → 作用/解释（打爆关键词时在爆炸中心展示）
const TY_HINTS = {
  'ping':'测网络通不通','ip':'查看 IP/网卡','ls':'列出目录文件','cat':'查看文件内容','cd':'切换目录',
  'sudo':'管理员权限执行','uname':'查看系统信息','hostname':'查看主机名','apt':'安装/管理软件包',
  'curl':'命令行访问网站','nslookup':'查域名对应 IP','traceroute':'追踪路由路径','iptables':'配置防火墙规则',
  'ss':'查看端口监听','grep':'搜索/过滤文本','nc':'测试端口连接','route':'查看路由表','ssh':'远程登录服务器',
  'nano':'命令行文本编辑器','whoami':'查看当前用户名','reboot':'重启系统','docker':'容器化部署工具','systemctl':'管理系统服务'
};




// ===== 登录弹窗队列：一次只弹一个、顺序弹出；重复弹窗默认每天一次 =====
let loginPopQueue = [];
let loginPopActive = false;
let pendingLevelComplete = null;
// 成就动画作为一个队列任务：排完当前成就再放行下一个弹窗
let achShowing = false;

let achDraining = false;

// —— 已看过的成就快照（登录后识别“老师新发/系统新发”的成就）——
const ACH_SEEN_KEY = 'ach_seen_v1';





// 📊 我的战绩







// =========================================================================
// 9c. PASSWORD SETTINGS
// =========================================================================



// 登录后未设置密码时的引导提示

// =========================================================================
// 9d. MINI GAMES — memory_match（术语翻牌热身）
// =========================================================================

// 提前发起加载并保存 promise，init 里 await 后再渲染关卡（避免首次刷新小游戏不显示）
const termCardsPromise = loadTermCards();

// 统计当前已解锁的小游戏类型数（按任务块完成判定）
// ===== 游戏专区：解锁后直接选玩 =====
let gzList = [];
let _mapFlowFeature = null;   // 本次由厂区地图 ?open=xxx 进入的功能（关闭时回地图，避免露旧界面）

// 统一结算回调：提示 + 刷新专区列表 & 关卡内嵌小游戏行


// 打开翻牌小游戏（memory_match）

// ===== 小游戏首次引导 =====
// 打字游戏引导：慢速掉一个词→提示打字→打爆→正式开战

// =========================================================================
// 9g. SHOOTER — 数据蜂群 · 保卫工厂（小蜜蜂/Galaxian 风格）
// =========================================================================
let shooterBuff = null;   // 商城道具·本局开局加成
let _shooterSkipLoadout = false;   // 本局已选择“不用道具”，不再弹装备窗







// =========================================================================
// 9x. SORTER — 数据分类大师（传送带分拣）
// 传送带送物品，点下方正确的分类筐归位；点错或溜到尽头掉命，速度越来越快

// =========================================================================
// 9y. FORGE — 数据熔炉（合成大西瓜·数据单位）
// 落下数据单元，同类相撞合成更大的；合成出目标单位即过关，堆满溢出失败

// =========================================================================
// 9z. LIANLIAN — 连连看·对对碰（术语-解释配对，≤2拐弯路径消除）

// =========================================================================
// 9w. PIPE — 管道工·数据通路（旋转管道接通数据流，L7 MQTT）

// =========================================================================
// 9v. MATCH3 — 消消乐·三连车间（同类三连消除，L5 分类）

// =========================================================================
// 9u. TOWER DEFENSE — 车间防线（部署防线拦攻击数据，L1 攻防）
// =========================================================================
// 9u. TOWER DEFENSE — 车间防线（部署防线拦攻击数据，L1 攻防）
// 知识嵌入：每种攻击有弱点，只有"克制它的设备"才能打出高伤害——
// 玩家必须理解"防火墙挡DDoS / IDS抓扫描 / 网关防ARP"才能守住


// =========================================================================
// 9s. MAZE — 数据迷宫·包到彼岸（迷宫寻路 + 知识门）

// =========================================================================
// 9r. HACKNET — 黑客终端·网络溯源（敲命令逐个攻破网络节点）

// =========================================================================
// 9q. TYCOON — 工厂大亨·数据经营（放置经营，ISA-95 逐级解锁）

// =========================================================================
// 9p. LASER — 激光反射·数据路由（放镜子把数据光束反射到目标）

// =========================================================================
// 9o. BOSS SLING — 愤怒的厂长·弹射排障（弹弓射出命令弹砸故障塔）




// 番外：堆叠式多层翻牌（一层层揭开）

// 连线匹配小游戏：左项↔右项配对

// 产线快打（命令快反）：看提示点对命令，计时+连击



// 术语图鉴（收藏）

// =========================================================================
// 10. LEVEL UP CHECK
// =========================================================================
let prevRank = null;



// =========================================================================
// 11. TOAST
// =========================================================================


// =========================================================================
// P2 NARRATIVE SYSTEM: Level Entry Dialogue
// =========================================================================

// =========================================================================
// P2 NARRATIVE SYSTEM: Level Complete Dialogue
// =========================================================================

function calculateLevelXP(levelId) {
  const lv = content.levels.find(l => l.id === levelId);
  if (!lv) return 0;
  let xp = 0;
  lv.tasks.forEach(t => {
    if (gameState.check[taskKey(t.id)]) xp += taskXP(t);
  });
  return xp;
}

// =========================================================================
// 概念动画「📺 看动画」：教材侧出 HTML 精简版(anim/*.html)，游戏侧播放器接入
// =========================================================================
const ANIM_MAP = {
  '2-6b': { file:'anim/closed_loop_lite.html', title:'数据闭环' }
  // '1-5b': { file:'anim/tcp_handshake_lite.html', title:'TCP 三次握手' },   // 教材侧精简版待批
  // '7-0':  { file:'anim/mqtt_pubsub_lite.html',  title:'MQTT 发布-订阅' },   // 教材侧精简版待批
};
function openTaskAnim(taskId){
  const a=ANIM_MAP[taskId];
  if(!a) return;
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.86);z-index:10010;display:flex;align-items:center;justify-content:center';
  const box=document.createElement('div');
  box.style.cssText='width:min(920px,92vw);background:#12121a;border:2px solid var(--amber);border-radius:10px;overflow:hidden;box-shadow:0 0 60px rgba(255,176,64,.25)';
  box.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid var(--border);background:rgba(8,11,20,.92)">
      <div style="color:var(--amber);font-weight:bold;font-size:15px;letter-spacing:1px">📺 概念动画 · ${a.title}</div>
      <div style="display:flex;gap:8px">
        <button id="animReplay" style="background:#22222e;border:1px solid var(--border);color:#c8c8d0;padding:6px 12px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:13px">↻ 重播</button>
        <button id="animClose" style="background:#3a2230;border:1px solid #6a3a4a;color:#ff9aa0;padding:6px 12px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:13px">✕ 关闭</button>
      </div>
    </div>
    <div style="position:relative;width:100%;aspect-ratio:16/9;background:#0b0e1a">
      <iframe id="animFrame" src="${a.file}" style="position:absolute;inset:0;width:100%;height:100%;border:0" allowfullscreen></iframe>
    </div>`;
  ov.appendChild(box);
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
  box.querySelector('#animClose').onclick=function(){ ov.remove(); };
  box.querySelector('#animReplay').onclick=function(){ const f=box.querySelector('#animFrame'); f.src=f.src; };
  // 加载兜底：iframe 加载失败提示
  const fr=box.querySelector('#animFrame');
  fr.onerror=function(){ box.querySelector('.anim-holder').innerHTML='<div style="color:var(--dim);padding:40px;text-align:center">⚠️ 动画加载失败，请稍后重试</div>'; };
}
// =========================================================================
// P2 NARRATIVE SYSTEM: Task Preface Dialogue
// =========================================================================
function showTaskPreface(task, onStart) {
  const teachText = generateTeach(task);
  const mood = 'guide';
  const moodEmoji = '👨‍💼';
  const moodLine = getRandomMoodLine(mood);
  
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);z-index:10001;display:flex;align-items:center;justify-content:center';
  
  const box = document.createElement('div');
  box.className = 'task-preface-box';
  box.style.cssText = 'background:#12121a;border:2px solid var(--cyan);border-radius:8px;padding:0;width:min(90%,560px);box-shadow:0 0 60px rgba(0,188,212,.2);overflow:hidden;max-height:86vh;display:flex;flex-direction:column';
  
  box.innerHTML = `
    <div class="director-box director-mood-thinking" style="margin:0;border-radius:0;border:none;border-bottom:1px solid var(--border);padding:16px 20px;flex:1;min-height:0;overflow-y:auto">
      <div class="director-portrait">${moodEmoji}</div>
      <div class="director-bubble">
        <div class="director-name">厂长</div>
        <div class="director-mood-line" style="font-size:13px;color:var(--cyan);margin-bottom:4px;font-style:italic">${moodLine}</div>
        <div class="director-text task-pref-text" id="taskPrefaceText" style="line-height:1.7;color:var(--text)"></div>
      </div>
    </div>
    <div style="padding:16px 20px;text-align:center;border-top:1px solid var(--border);background:rgba(0,0,0,.2)">
      <div style="display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap">
        ${ANIM_MAP[task.id] ? '<button id="taskAnimBtn" style="padding:10px 20px;background:var(--amber);color:#1a1206;border:none;border-radius:4px;font-size:14px;font-weight:bold;cursor:pointer;font-family:inherit">📺 看动画</button>' : ''}
        <button id="taskPrefaceBtn" style="padding:10px 32px;background:var(--cyan);color:#000;border:none;border-radius:4px;font-size:15px;font-weight:bold;cursor:pointer;font-family:inherit;opacity:0.5" disabled>
          正在讲解...
        </button>
      </div>
    </div>
  `;
  
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  
  const textEl = box.querySelector('#taskPrefaceText');
  const btn = box.querySelector('#taskPrefaceBtn');
  const animBtn = box.querySelector('#taskAnimBtn');
  if(animBtn) animBtn.onclick = function(){ openTaskAnim(task.id); };
  // 回车 = 点「收到，开始操作」（文字播完、按钮可用后才生效）
  const onPrefaceKey = function(e){ if(e.key==='Enter'){ const b=box.querySelector('#taskPrefaceBtn'); if(b && !b.disabled){ b.click(); } } };
  window.addEventListener('keydown', onPrefaceKey);
  
  typewrite(textEl, teachText, 20, () => {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = '收到，开始操作';
    playSound('click');
  });
  
  btn.onclick = () => {
    window.removeEventListener('keydown', onPrefaceKey);
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .3s';
    setTimeout(() => overlay.remove(), 300);
    playSound('click');
    if (onStart) onStart();
  };
  
  return overlay;
}

function showToast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + (type || 'info');
  el.classList.add('show');
  clearTimeout(el._hide);
  el._hide = setTimeout(() => el.classList.remove('show'), 1500);
}

// 🐛 抓虫有奖 - Bug 反馈
function openBugReport(){ document.getElementById('bugOverlay').classList.add('show'); }
function closeBugReport(){ document.getElementById('bugOverlay').classList.remove('show'); document.getElementById('bugErr').textContent=''; }
async function submitBugReport(){
  const loc=document.getElementById('bugLocation').value.trim();
  const content=document.getElementById('bugContent').value.trim();
  const err=document.getElementById('bugErr');
  if(!content){ err.textContent='请描述一下你遇到的问题'; return; }
  const btn=document.getElementById('bugSubmit'); btn.disabled=true; btn.textContent='提交中…';
  const res=await api('/api/student/bug-report',{method:'POST',body:JSON.stringify({location:loc,content})});
  btn.disabled=false; btn.textContent='🐛 提交反馈';
  if(!res || !res.ok){ err.textContent=(res&&res.error)||'提交失败，请重试'; return; }
  closeBugReport(); showToast('🐛 已收到反馈，谢谢！抓虫有奖','success');
}

// =========================================================================
// 12. LOGOUT
// =========================================================================
function hideTransit(){ var t=document.getElementById('transit'); if(t){ setTimeout(function(){ t.classList.remove('show'); }, 150); } }
function goMap(){
  // 从房间进入的任务：返回时直接回房间 room.html?room=xx；否则回厂区地图
  var target='map_proto.html';
  try{ var mr=sessionStorage.getItem('mapRoom'); if(mr) target='room.html?room='+mr; }catch(e){}
  var t=document.getElementById('transit');
  if(t){ var e=document.getElementById('trText'); if(e) e.innerHTML='正在返回 <b>厂区</b>…'; t.classList.add('show'); }
  setTimeout(function(){ location.href=target; }, 500);
}
function logout() {
  sessionStorage.clear();
  var t=document.getElementById('transit');
  if(t){ var e=document.getElementById('trText'); if(e) e.innerHTML='正在退出…'; t.classList.add('show'); }
  setTimeout(function(){ location.href='index.html'; }, 400);
}

// =========================================================================
// 13. INIT
// =========================================================================
async function init() {
  setupGlobalEnter();   // 全局回车确认（回厂区继续/知道了再试一次/任务提交），提前绑定
  const _urlQ = new URLSearchParams(location.search);
  const _fromMap = !!( _urlQ.get('task') || _urlQ.get('level') || _urlQ.get('open') );
  if (_fromMap) { try { sessionStorage.setItem('mapFlow', '1'); } catch(e){} }
  await loadGameContent();
  if (!content) {
    document.getElementById('missionTitle').textContent = '无法加载游戏内容';
    return;
  }
  await loadState();
  await termCardsPromise;   // 确保小游戏(term-cards)数据就绪后再渲染，一次刷新即稳定显示
  detectNewServerAchievements();
  prevRank = getRank(calcTotalXP());
  renderFactory();
  renderMission();
  renderHeader();
  renderAchBar();
  // 8bit 背景音乐（按场景切换）
  loadMusicPref();
  const _musicBtn = document.getElementById('musicToggle');
  if (_musicBtn) _musicBtn.textContent = musicEnabled ? '🎵' : '🔕';
  // 按当前进度定位到第一个可进入的幕，播放对应区域背景乐
  const _startLv = content.levels.find(l => l.id === 1 || (l.id > 1 && levelProgress(l.id - 1).completed)) || content.levels[0];
  setArea(_startLv ? _startLv.id : 1);
  playAreaMusic();
  document.addEventListener('pointerdown', function _firstGesture(){
    try { const _c = getAudioCtx(); if (_c && _c.state === 'suspended') _c.resume(); } catch(e){}
    ensureMusicPlayback();
    document.removeEventListener('pointerdown', _firstGesture);
  });
  // 评估并弹出新解锁成就；异步刷新排行榜后再次评估（捕捉先锋等依赖排行数据的成就）
  evaluateAchievements(true);
  refreshLeaderboard().then(() => evaluateAchievements(true));
  // —— 登录弹窗队列：按顺序一次一个（成就动画→关卡结算→厂长欢迎→改密引导；重复弹窗每天一次）——
  enqueueAchievementsJob();
  if (pendingLevelComplete && !popupShownToday('lv')) {
    markPopupToday('lv');
    enqueueLoginPopup(done => showLevelComplete(pendingLevelComplete, done));
  }
  const isReturning = gameState.check && Object.keys(gameState.check).length > 0;
  const greetLines = isReturning
    ? ['👨‍💼 厂长推门进来：「回来了？上次你修的产线跑得不错。今天还有活，别歇着。」']
    : ['👨‍💼 厂长走过来，递给你工牌：「新来的？我是厂长。你负责把中控室搭起来——装系统、通网络、调链路。我在里面等你。」'];
  if (!popupShownToday('welcome')) {
    markPopupToday('welcome');
    enqueueLoginPopup(done => showWelcomeDialog(greetLines[0], done));
  }
  if (PASSWORD_ENABLED && !gameState.hasPassword && !popupShownToday('pw')) {
    markPopupToday('pw');
    enqueueLoginPopup(done => showPasswordPrompt(done));
  }
}



// ═══════════════════════════════════════════════════════════════════
// ES Module 全局挂载
//  - 函数 & 常量 → Object.assign 值挂载（onclick / window.openXxx 测试调用）
//  - 可变状态(let/var) → defineProperty getter 挂载（始终反映模块变量当前值，
//    避免 Object.assign 挂在 init() 之前的初始值导致的 stale 问题）
// 后续拆子模块后逐步收敛为"只挂 onclick 需要的"
// ═══════════════════════════════════════════════════════════════════
Object.assign(window, {
  ACHIEVEMENTS,
  ACH_SEEN_KEY,
  API,
  BG_TRACKS,
  ENEMY_SKIN_COLORS,
  PLANE_SKINS,
  RANKS,
  SNAKE_SKINS,
  TY_HINTS,
  _fmtTime,
  achievementContext,
  addDirectorBox,
  addTaskItemBar,
  api,
  applyMiniTier,
  areaStars,
  buildGameZone,
  buildWallet,
  bumpGameStats,
  buyItem,
  calcTotalXP,
  calculateLevelXP,
  checkLevelUp,
  claimSalaryNow,
  closeBugReport,
  closeGameRecords,
  closeGameZone,
  closeGameRoom,
  buildGameRoom,
  openGameRoom,
  renderGameRoom,
  gzOpenType,
  closeLb,
  closeModal,
  closePasswordModal,
  closePedia,
  closeTaskModal,
  closeWallet,
  completeTask,
  countUnlockedGameTypes,
  detectNewServerAchievements,
  drainAchQueue,
  drainLoginPopups,
  dstr,
  enqueueAchievementsJob,
  enqueueLoginPopup,
  equipSkin,
  equippedEnemySkin,
  escHtml,
  evaluateAchievements,
  findTaskAnswer,
  focusResultPrimary,
  gameSong,
  generateTeach,
  getAudioCtx,
  getDirectorMood,
  getEquippedSkin,
  getGameStats,
  getInteraction,
  getLevelTasks,
  getMusicSong,
  getPedia,
  getPediaCount,
  getRandomMoodLine,
  getRank,
  getSeenAch,
  getTermLevel,
  glowCorrect,
  goMap,
  gzAfter,
  gzEmoji,
  gzMeta,
  gzName,
  gzPlay,
  isUnlocked,
  hideTransit,
  init,
  interactions,
  isTaskDone,
  levelProgress,
  loadGameContent,
  loadKnowledgeTags,
  loadShop,
  loadState,
  loadTermCards,
  logout,
  markPopupToday,
  markTermWarmupDone,
  miniGames,
  miniMarkClear,
  miniTier,
  miniTierBadge,
  myName,
  nextMusic,
  openAchievements,
  openAlarmRush,
  openBoss,
  openBreakout,
  openBugReport,
  openDataRacing,
  openFlappy,
  openForge,
  openGameRecords,
  openGameZone,
  openHacknet,
  openLaser,
  openLeaderboard,
  openLianLian,
  openMatch3,
  openMatchGame,
  openMaze,
  openMemoryMatch,
  openMole,
  openPacman,
  openPasswordModal,
  openPedia,
  openPipe,
  openQuickMatch,
  openShooter,
  openSnake,
  openSorter,
  openStackedMatch,
  openStormDefense,
  openTank,
  openTaskModal,
  openTaskAnim,
  openTile2048,
  openTowerDefense,
  openTycoon,
  openTypingDefense,
  openWallet,
  pediaCount,
  playAreaMusic,
  playMusic,
  playSound,
  popupShownToday,
  recordGameWin,
  refreshGameZone,
  refreshLeaderboard,
  registerInteraction,
  registerMiniGame,
  renderAchBar,
  renderAchievements,
  renderFactory,
  renderGameRecords,
  renderGameZone,
  renderHeader,
  renderLeaderboard,
  renderMission,
  renderPedia,
  renderTypeTerminal,
  renderWallet,
  role,
  saveGameStats,
  savePassword,
  savePedia,
  saveState,
  selectLevel,
  setArea,
  setSeenAch,
  shakeScreen,
  showAchievementUnlock,
  showGameTutorial,
  showLevelComplete,
  showLevelIntro,
  showLevelUp,
  showPasswordPrompt,
  showShooterLoadout,
  showTaskHintPopup,
  showTaskPreface,
  showToast,
  showTypingTutorial,
  showWelcomeDialog,
  starStr,
  submitBugReport,
  switchLbTab,
  taskKey,
  taskXP,
  termCardsPromise,
  termWarmupDone,
  toggleMusic,
  toggleSound,
  toggleTask,
  finishTaskFlow,
  token,
  tutMark,
  tutSeen,
  typewrite,
  unlockPedia,
  updateDirectorAvatar,
  useTaskHint,
  useTaskPass,
  walletRank
});

Object.defineProperty(window, 'PASSWORD_ENABLED', { get: () => PASSWORD_ENABLED, set: v => { PASSWORD_ENABLED = !!v; }, configurable: true });
Object.defineProperty(window, 'SHOP_CACHE', { get: () => SHOP_CACHE, set: v => { SHOP_CACHE = v; }, configurable: true });
Object.defineProperty(window, '_mapFlowFeature', { get: () => _mapFlowFeature, set: v => { _mapFlowFeature = v; }, configurable: true });
Object.defineProperty(window, '_shooterSkipLoadout', { get: () => _shooterSkipLoadout, set: v => { _shooterSkipLoadout = v; }, configurable: true });
Object.defineProperty(window, 'achDraining', { get: () => achDraining, set: v => { achDraining = v; }, configurable: true });
Object.defineProperty(window, 'achQueue', { get: () => achQueue, set: v => { achQueue = v; }, configurable: true });
Object.defineProperty(window, 'achShowing', { get: () => achShowing, set: v => { achShowing = v; }, configurable: true });
Object.defineProperty(window, 'audioCtx', { get: () => audioCtx, configurable: true });
Object.defineProperty(window, 'bgIdx', { get: () => bgIdx, configurable: true });
Object.defineProperty(window, 'content', { get: () => content, set: v => { content = v; }, configurable: true });
Object.defineProperty(window, 'currentAreaKey', { get: () => currentAreaKey, set: v => { currentAreaKey = v; }, configurable: true });
Object.defineProperty(window, 'currentLevelId', { get: () => currentLevelId, set: v => { currentLevelId = v; }, configurable: true });
Object.defineProperty(window, 'currentTaskId', { get: () => currentTaskId, set: v => { currentTaskId = v; }, configurable: true });
Object.defineProperty(window, 'currentTrack', { get: () => currentTrack, configurable: true });
Object.defineProperty(window, 'directorMood', { get: () => directorMood, set: v => { directorMood = v; }, configurable: true });
Object.defineProperty(window, 'directorMoodLines', { get: () => directorMoodLines, set: v => { directorMoodLines = v; }, configurable: true });
Object.defineProperty(window, 'errors', { get: () => errors, set: v => { errors = v; }, configurable: true });
Object.defineProperty(window, 'gameState', { get: () => gameState, set: v => { gameState = v; }, configurable: true });
Object.defineProperty(window, 'gzList', { get: () => gzList, set: v => { gzList = v; }, configurable: true });
Object.defineProperty(window, 'lbTab', { get: () => lbTab, set: v => { lbTab = v; }, configurable: true });
Object.defineProperty(window, 'leaderboardCache', { get: () => leaderboardCache, set: v => { leaderboardCache = v; }, configurable: true });
Object.defineProperty(window, 'loginPopActive', { get: () => loginPopActive, set: v => { loginPopActive = v; }, configurable: true });
Object.defineProperty(window, 'loginPopQueue', { get: () => loginPopQueue, set: v => { loginPopQueue = v; }, configurable: true });
Object.defineProperty(window, 'musicEnabled', { get: () => musicEnabled, configurable: true });
Object.defineProperty(window, 'musicGainNode', { get: () => musicGainNode, configurable: true });
Object.defineProperty(window, 'musicSrc', { get: () => musicSrc, configurable: true });
Object.defineProperty(window, 'pendingLevelComplete', { get: () => pendingLevelComplete, set: v => { pendingLevelComplete = v; }, configurable: true });
Object.defineProperty(window, 'prevRank', { get: () => prevRank, set: v => { prevRank = v; }, configurable: true });
Object.defineProperty(window, 'selfTeachTypes', { get: () => selfTeachTypes, set: v => { selfTeachTypes = v; }, configurable: true });
Object.defineProperty(window, 'shooterBuff', { get: () => shooterBuff, set: v => { shooterBuff = v; }, configurable: true });
Object.defineProperty(window, 'soundEnabled', { get: () => soundEnabled, configurable: true });
Object.defineProperty(window, 'streak', { get: () => streak, set: v => { streak = v; }, configurable: true });

init().then(() => {
  // —— 从厂区地图跳转：?task=1-0 或 ?level=1 自动定位 ——
  const p = new URLSearchParams(location.search);
  const taskId = p.get('task');
  const levelId = p.get('level');
  const openFeat = p.get('open');
  const backBtn = document.getElementById('backMapBtn');
  if (backBtn && (taskId || levelId || openFeat)) backBtn.style.display = '';
  const _crumbEl = document.getElementById('mapCrumb');
  if (_crumbEl && (taskId || levelId || openFeat)) _crumbEl.style.display = '';
  if (taskId || levelId || openFeat) { try { sessionStorage.setItem('mapFlow', '1'); } catch(e){} }
  // 地图流程（task/level/open）：隐藏旧版关卡页，跳转不闪旧界面
  if (taskId || levelId || openFeat) document.body.classList.add('map-flow');
  if (openFeat) {
    const featMap = { game: openGameZone, gameroom: openGameRoom, pedia: openPedia, leaderboard: openLeaderboard, achievements: openAchievements, wallet: openWallet };
    const fn = featMap[openFeat];
    if (openFeat) _mapFlowFeature = openFeat;
    if (fn) setTimeout(() => { try { fn(); } catch(e){} }, 600);
    setTimeout(() => hideTransit(), 1500);   // 功能浮层打开后淡出过场
  }
  if (taskId || levelId || openFeat) {
    // 顶部面包屑：明确是在厂区地图的任务流
    let crumb = '';
    if (taskId || levelId) {
      const _lv = content.levels.find(l => (taskId ? (l.tasks || []).some(t => String(t.id) === taskId) : String(l.id) === levelId));
      const _t = taskId ? (_lv && _lv.tasks.find(t => String(t.id) === taskId)) : null;
      crumb = '🗺️ 厂区地图 › ' + (_lv ? _lv.areaName : '') + (_t ? ' · ' + _t.title : '');
    } else {
      const _names = { game: '游戏专区', gameroom: '游戏房', pedia: '术语图鉴', leaderboard: '排行榜', achievements: '成就', wallet: '工资与商城' };
      crumb = '🗺️ 厂区地图 › ' + (_names[openFeat] || '');
    }
    const _bc = document.getElementById('mapCrumb');
    if (_bc) _bc.textContent = crumb;
  }
  if (taskId || levelId) {
    let lv = null;
    if (taskId) lv = content.levels.find(l => (l.tasks || []).some(t => String(t.id) === taskId));
    if (!lv && levelId) lv = content.levels.find(l => String(l.id) === levelId);
    if (lv) {
      const realTask = taskId ? lv.tasks.find(t => String(t.id) === taskId) : null;
      selectLevel(lv.id, !!realTask);
      if (realTask) {
        // 排进登录弹窗队列之后打开：欢迎/改密逐个关完，再进任务前言，避免弹窗轰炸
        enqueueLoginPopup(done => openTaskModal(lv.id, realTask.id, function(){ hideTransit(); done(); }));
      } else {
        // 只进关卡（?level=X 无具体任务）：没有任务弹窗负责收尾，直接淡出过场，避免卡在"正在进入关卡"
        setTimeout(() => hideTransit(), 300);
      }
    }
  }
});
