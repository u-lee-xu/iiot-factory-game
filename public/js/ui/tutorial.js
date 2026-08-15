// ═══════════════════════════════════════════════════════════════════
// ui/tutorial.js — tutorial 模块（拆自 app.js）
// import core/*；其余公共函数经 window
// ═══════════════════════════════════════════════════════════════════
import { escHtml } from '../core/utils.js';
import { playSound } from '../core/sound.js';

export function tutSeen(t){ try{ return localStorage.getItem('game_tut_'+t)==='1'; }catch(e){ return false; } }

export function tutMark(t){ try{ localStorage.setItem('game_tut_'+t,'1'); }catch(e){} }

export function showGameTutorial(type, title, steps, onDone){
  const ov=document.createElement('div');
  ov.className='mm-overlay';
  ov.innerHTML='<div class="tut-box"><div class="tut-title">'+title+'</div>'+
    steps.map(s=>'<div class="tut-step">'+s+'</div>').join('')+
    // （去掉“仅首次显示”提示）
    '<button class="mm-btn primary" id="tutStart" style="margin-top:14px;font-size:16px">开始游戏 →</button></div>';
  document.body.appendChild(ov);
  ov.querySelector('#tutStart').onclick=()=>{ ov.remove(); tutMark(type); onDone(); };
}

export function showTypingTutorial(cfg, onDone){
  const words=(cfg.words||[]).filter(Boolean); const word=String(words[Math.floor(Math.random()*words.length)]||'ping');
  const ov=document.createElement('div');
  ov.className='mm-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9500;display:flex;align-items:center;justify-content:center';
  ov.innerHTML='<div class="ty-box">'+
    '<div class="mm-head"><div><div class="mm-title">🔫 术语防御战 · 新手上路</div><div class="mm-sub">关键词往下掉，敲出完整命令把它打下来！先试一个，跟着打：</div></div>'+
    '<div class="mm-close" id="tutX">✕</div></div>'+
    '<div class="ty-stats"><span>⌨️ 请打出：<b style="color:var(--amber)">'+escHtml(word)+'</b></span></div>'+
    '<div class="ty-field" id="tutField" style="min-height:180px"></div>'+
    '<div class="ty-cannon">🔫</div>'+
    '<input id="tutInput" autocomplete="off" spellcheck="false" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none"></div>';
  document.body.appendChild(ov);
  const field=ov.querySelector('#tutField'); const input=ov.querySelector('#tutInput');
  const el=document.createElement('div'); el.className='ty-word'; el.textContent=word;
  el.style.left='30%'; el.style.top='24px'; field.appendChild(el);
  input.focus();
  let typed='';
  ov.querySelector('#tutX').onclick=()=>{ ov.remove(); tutMark('typing'); onDone(); };
  input.addEventListener('keydown', function(e){
    e.preventDefault(); if(e.key.length!==1) return; playSound('type');
    if(word.indexOf(typed+e.key)===0){
      typed+=e.key;
      el.innerHTML='<span class="ty-prefix">'+escHtml(typed)+'</span>'+escHtml(word.slice(typed.length));
      if(typed===word){
        playSound('success'); el.classList.add('ty-boom');
        setTimeout(function(){
          ov.innerHTML='<div class="ty-result"><div style="font-size:46px">🎉</div>'+
            '<div style="font-size:20px;color:var(--green);font-weight:bold;margin-top:8px">太棒了！打爆一个</div>'+
            '<div style="font-size:15px;color:var(--dim);margin-top:6px;line-height:1.7">接下来正式开战：词会越来越快<br>记住——输错就重新开始</div>'+
            '<button class="mm-btn primary" id="tutGo" style="margin-top:16px;font-size:16px">正式开战 →</button></div>';
          ov.querySelector('#tutGo').onclick=function(){ ov.remove(); tutMark('typing'); onDone(); };
        }, 700);
      }
    } else {
      typed=''; el.innerHTML=escHtml(word); playSound('error');
    }
  });
}

export function showShooterLoadout(cfg, onComplete) {
  const inv = window.gameState.inventory || {};
  const opts = [];
  if ((inv['power_card']||0) > 0) opts.push({id:'power_card', e:'🚀', name:'火力礼包', desc:'开局直接 2 级火力', key:'pLevel'});
  if ((inv['shield_card']||0) > 0) opts.push({id:'shield_card', e:'❤️', name:'开局护盾', desc:'开局 +1 命', key:'lives'});
  if ((inv['slow_card']||0) > 0) opts.push({id:'slow_card', e:'⏳', name:'慢速卡', desc:'敌人全场缓速 8 秒', key:'slow'});
  const ov=document.createElement('div');
  ov.className='mm-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9550;display:flex;align-items:center;justify-content:center';
  let boxes='';
  opts.forEach(function(o,i){ boxes+='<label class="gz-row" style="cursor:pointer;flex:1;min-width:130px;margin:0"><input type="checkbox" id="lod_'+i+'" checked> <span class="gz-emoji">'+o.e+'</span> <span class="gz-name">'+o.name+'<span style="display:block;font-size:12px;color:var(--dim)">'+o.desc+'</span></span></label>'; });
  ov.innerHTML='<div class="mm-box mm-fill" style="width:min(480px,92vw)"><div class="mm-head"><div><div class="mm-title">🎒 装备道具</div><div class="mm-sub">开局选商城买的一次性道具，更顺手</div></div></div><div class="mm-stats" style="margin-bottom:10px;flex-wrap:wrap">'+boxes+'</div><div style="display:flex;gap:10px;justify-content:center;margin-top:6px"><button class="mm-btn" onclick="window.__lodSkip()">不用道具</button><button class="mm-btn primary" onclick="window.__lodStart()">开始游戏</button></div></div>';
  document.body.appendChild(ov);
  window.__lodCfg=cfg; window.__lodDone=onComplete;
  window.__lodStart=function(){
    const use=[];
    opts.forEach(function(o,i){ const cb=document.getElementById('lod_'+i); if(cb && cb.checked) use.push(o); });
    const buff={lives:0,pLevel:0,slow:0};
    use.forEach(function(o){
      window.api('/api/student/consume-item',{method:'POST',body:JSON.stringify({itemId:o.id})}).then(function(r){
        if (r && r.ok && window.gameState.inventory[o.id]) {
          window.gameState.inventory[o.id]--;
          if (window.gameState.inventory[o.id]<=0) delete window.gameState.inventory[o.id];
        }
      });
      if (o.key==='lives') buff.lives=1;
      else if (o.key==='pLevel') buff.pLevel=1;
      else if (o.key==='slow') buff.slow=1;
    });
    window.shooterBuff=buff;
    window._shooterSkipLoadout=true;
    ov.remove();
    window.renderHeader();
    window.openShooter(cfg, onComplete);
  };
  window.__lodSkip=function(){ window._shooterSkipLoadout=true; ov.remove(); window.openShooter(cfg, onComplete); };
}
