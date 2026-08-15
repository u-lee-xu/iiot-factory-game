// ═══════════════════════════════════════════════════════════════════
// ui/wallet.js — wallet 模块（拆自 app.js）
// import core/*；其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';

export function loadShop() {
  if (window.SHOP_CACHE) return Promise.resolve(window.SHOP_CACHE);
  return window.api('/api/student/shop').then(r => { window.SHOP_CACHE = (r && r.ok) ? r.data : []; return window.SHOP_CACHE; }).catch(() => []);
}

export function walletRank(xp) {
  var R=[{min:0,t:'实习生',e:'🔰'},{min:1000,t:'学徒',e:'🔧'},{min:2500,t:'技工',e:'⚙️'},{min:4500,t:'工程师',e:'🛠️'},{min:7000,t:'专家',e:'🏆'}];
  var r=R[0]; for (var i=0;i<R.length;i++) if (xp>=R[i].min) r=R[i];
  return r;
}

export function buildWallet() {
  if (document.getElementById('walletOverlay')) return;
  var ov=document.createElement('div');
  ov.className='gz-overlay'; ov.id='walletOverlay';
  ov.innerHTML='<div class="gz-box"><div class="pd-head"><div><div class="pd-title">💰 工资与商城</div><div class="pd-sub">上班打卡领工资 · 金币买道具</div></div><div class="pd-close" onclick="closeWallet()">✕</div></div><div class="pd-body" id="walletBody"></div></div>';
  document.body.appendChild(ov);
}

export function openWallet(){ buildWallet(); renderWallet(); document.getElementById('walletOverlay').classList.add('show'); }

export function closeWallet(){ if (window._mapFlowFeature) { window.goMap(); return; } var o=document.getElementById('walletOverlay'); if(o) o.classList.remove('show'); }

export function renderWallet() {
  var body=document.getElementById('walletBody'); if(!body) return;
  var si=window.gameState.salaryInfo||{}, inv=window.gameState.inventory||{}, coins=window.gameState.coins||0;
  var rank=walletRank(si.xp||0), rate=si.rate||100;
  loadShop().then(function(items){
    var html='';
    html+='<div class="gz-section">📅 上班打卡</div>';
    html+='<div class="gz-row" style="cursor:default"><span class="gz-emoji">'+rank.e+'</span><span class="gz-name">'+rank.t+' · 日薪 <b style="color:var(--amber)">'+rate+'</b> 金币</span><span class="gz-meta">本月累计 <b style="color:var(--amber)">'+(si.monthTotal||0)+'</b></span></div>';
    if (si.claimedToday) html+='<div class="gz-row" style="cursor:default;border-color:var(--green)"><span class="gz-emoji">✅</span><span class="gz-name">今日工资已领（'+rate+' 金币）</span></div>';
    else html+='<div class="gz-row" onclick="claimSalaryNow()"><span class="gz-emoji">🕐</span><span class="gz-name">今日还没打卡领工资</span><span class="gz-meta"><button class="mm-btn primary" onclick="event.stopPropagation();claimSalaryNow()">打卡 +'+rate+'</button></span></div>';
    html+='<div class="gz-section">🛒 商城 · 余额 <b style="color:var(--amber)">'+coins+'</b> 💰</div>';
    (items||[]).forEach(function(it){
      var afford=coins>=it.price;
      var owned=(inv[it.id]||0)>0 && (it.type==='skin'||it.type==='title') ? '已拥有' : '';
      html+='<div class="gz-row" style="cursor:default"><span class="gz-emoji">'+it.emoji+'</span><span class="gz-name">'+escHtml(it.name)+' <span style="font-size:12px;color:var(--dim)">'+escHtml(it.desc)+'</span></span><span class="gz-meta">'+it.price+'💰 '+(owned?owned+' · ':'')+'</span><span><button class="mm-btn'+(afford?' primary':'')+'" data-id="'+it.id+'" '+(afford?'onclick="buyItem(this.dataset.id)"':'disabled style="opacity:.4"')+'>购买</button></span></div>';
    });
    var ownedList=Object.keys(inv).filter(function(k){return inv[k]>0;});
    html+='<div class="gz-section">🎒 背包</div>';
    if (!ownedList.length) html+='<div class="gz-row" style="cursor:default"><span class="gz-name" style="color:var(--dim)">背包空空，去商城买点道具吧</span></div>';
    else {
      ownedList.forEach(function(id){
        var it=null; (items||[]).forEach(function(x){ if(x.id===id) it=x; });
        var usable=(it && (it.type==='shooter'||it.type==='task'));
        html+='<div class="gz-row" style="cursor:default"><span class="gz-emoji">'+(it?it.emoji:'🎁')+'</span><span class="gz-name">'+escHtml(it?it.name:id)+' ×'+inv[id]+'</span><span class="gz-meta">'+(usable?'进游戏时可用':'永久生效')+'</span></div>';
      });
    }
    // 外观
    html+='<div class="gz-section">🎨 外观（装备皮肤，永久）</div>';
    html+='<div class="gz-row" style="cursor:default;background:none"><span class="gz-name" style="font-size:13px;color:var(--cyan)">✈️ 飞机皮肤</span></div>';
    Object.keys(window.PLANE_SKINS).forEach(function(id){
      var sk=window.PLANE_SKINS[id], owned=(id==='default')||(inv[id]>0), eq=getEquippedSkin('plane')===id;
      html+='<div class="gz-row" style="cursor:default"><span class="gz-emoji" style="background:'+sk.col+';width:18px;height:18px;border-radius:4px;display:inline-block"></span><span class="gz-name">'+sk.name+'</span><span class="gz-meta">'+(eq?'已装备':(owned?'已拥有':'未拥有'))+'</span><span>'+(owned&&!eq?'<button class="mm-btn" data-type="plane" data-id="'+id+'" onclick="equipSkin(this.dataset.type,this.dataset.id)">装备</button>':'')+'</span></div>';
    });
    html+='<div class="gz-row" style="cursor:default;background:none"><span class="gz-name" style="font-size:13px;color:var(--cyan)">👾 敌人皮肤</span></div>';
    Object.keys(window.ENEMY_SKIN_COLORS).forEach(function(id){
      var sk=window.ENEMY_SKIN_COLORS[id], owned=(id==='default')||(inv[id]>0), eq=getEquippedSkin('enemy')===id;
      html+='<div class="gz-row" style="cursor:default"><span class="gz-emoji" style="background:'+sk.col+';width:18px;height:18px;border-radius:4px;display:inline-block"></span><span class="gz-name">'+sk.name+'</span><span class="gz-meta">'+(eq?'已装备':(owned?'已拥有':'未拥有'))+'</span><span>'+(owned&&!eq?'<button class="mm-btn" data-type="enemy" data-id="'+id+'" onclick="equipSkin(this.dataset.type,this.dataset.id)">装备</button>':'')+'</span></div>';
    });
    html+='<div class="gz-row" style="cursor:default;background:none"><span class="gz-name" style="font-size:13px;color:var(--cyan)">🐍 蛇皮肤</span></div>';
    Object.keys(window.SNAKE_SKINS||{}).forEach(function(id){
      var sk=window.SNAKE_SKINS[id], owned=(id==='default')||(inv[id]>0), eq=getEquippedSkin('snake')===id;
      html+='<div class="gz-row" style="cursor:default"><span class="gz-emoji" style="background:'+sk.col+';width:18px;height:18px;border-radius:4px;display:inline-block"></span><span class="gz-name">🐍 '+sk.name+'</span><span class="gz-meta">'+(eq?'已装备':(owned?'已拥有':'未拥有'))+'</span><span>'+(owned&&!eq?'<button class="mm-btn" data-type="snake" data-id="'+id+'" onclick="equipSkin(this.dataset.type,this.dataset.id)">装备</button>':'')+'</span></div>';
    });
    body.innerHTML=html;
  });
}

export function claimSalaryNow() {
  window.api('/api/student/claim-salary', { method:'POST', body:'{}' }).then(function(r){
    if (r && r.ok) {
      window.gameState.coins=r.data.coins;
      window.gameState.salaryInfo=Object.assign({}, window.gameState.salaryInfo, { monthTotal:r.data.monthTotal, rate:r.data.rate, claimedToday:true });
      window.showToast('💰 打卡成功 +'+r.data.gained+' 金币','success');
      renderWallet(); window.renderHeader();
    } else window.showToast((r&&r.error)||'打卡失败','error');
  });
}

export function buyItem(itemId) {
  window.api('/api/student/buy', { method:'POST', body:JSON.stringify({itemId:itemId}) }).then(function(r){
    if (r && r.ok) {
      window.gameState.coins=r.data.coins; window.gameState.inventory=r.data.inventory;
      window.showToast('🛒 购买成功！','success');
      renderWallet(); window.renderHeader();
    } else window.showToast((r&&r.error)||'购买失败','error');
  });
}

export function getEquippedSkin(type){ try{ return localStorage.getItem('skin_'+type) || 'default'; }catch(e){ return 'default'; } }

export function equippedEnemySkin(){ var m=window.ENEMY_SKIN_COLORS[getEquippedSkin('enemy')]; return m ? m.col : null; }

export function equipSkin(type, id){
  var inv=window.gameState.inventory||{};
  if (id!=='default' && !(inv[id]>0)) { window.showToast('还没有这个皮肤，先去商城买', 'error'); return; }
  try{ localStorage.setItem('skin_'+type, id); }catch(e){}
  var nm = type==='plane' ? ((window.PLANE_SKINS[id]||{}).name)
            : type==='snake' ? ((window.SNAKE_SKINS[id]||{}).name)
            : ((window.ENEMY_SKIN_COLORS[id]||{}).name);
  window.showToast('🎨 已装备：'+(nm||id), 'success');
  renderWallet();
}
