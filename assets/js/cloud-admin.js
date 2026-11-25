
/* V27 开发者云端发布桥接：保留 V26 编辑器全部功能，受 Supabase RLS 管控。 */
(function(){
'use strict';
const H=window.HWCloud||{client:null,ready:Promise.resolve(null),user:null,escapeHtml:s=>String(s??''),errMsg:e=>e?.message||String(e),onAuth:cb=>cb(null)};const $=id=>document.getElementById(id);
const S=(s)=>H.escapeHtml(s);
const u=()=>H.client;
/* V39: persist every hot-topic change with the developer's real Supabase session. */
window.hwSavePublicTrends=async function(value){
 await H.ready;
 if(!H.client||!H.user)throw Error('请先在开发者端登录云端账号');
 if(!await H.isAdmin())throw Error('当前账号没有开发者写入权限');
 const {error}=await H.client.from('hw_site_settings').upsert({key:'public_trends',value,updated_at:new Date().toISOString()},{onConflict:'key'});
 if(error)throw error;
 const check=await H.client.from('hw_site_settings').select('value').eq('key','public_trends').single();
 if(check.error)throw check.error;
 const normalizeTrends=(items)=>Array.isArray(items)?items.map(item=>({
  context:String(item?.context??''),title:String(item?.title??''),count:String(item?.count??'0')
 })):null;
 const expected=normalizeTrends(value),actual=normalizeTrends(check.data?.value);
 if(!actual||actual.length!==expected.length||actual.some((item,i)=>item.context!==expected[i].context||item.title!==expected[i].title||item.count!==expected[i].count)){
  throw Error('热点保存内容与读取结果不一致，请检查网络后重试');
 }
 return true;
};

let admin=false,busy=false,autoTimer=null,autoEnabled=false,activeConversation=null;
const style=document.createElement('style');style.textContent=`
#hw-cloud-panel{position:fixed;right:14px;top:78px;bottom:auto;width:min(378px,calc(100vw - 28px));z-index:9999;background:#fff;color:#0f1419;border:1px solid #cbd5df;border-radius:17px;box-shadow:0 12px 44px #1233;font:14px system-ui,-apple-system,sans-serif;max-height:calc(100vh - 82px);overflow:auto}
#hw-cloud-panel[hidden],#hwCloudLogin[hidden],#hwCloudOtherAccount[hidden]{display:none!important}#hw-cloud-panel *{box-sizing:border-box}#hw-cloud-panel .hw-head{display:flex;justify-content:space-between;align-items:center;background:#f3f7fb;border-bottom:1px solid #dce3ea;padding:12px 14px;border-radius:17px 17px 0 0}
#hw-cloud-panel .hw-body{padding:13px;display:grid;gap:9px}#hw-cloud-panel h3{font-size:15px;margin:0}#hw-cloud-panel input:not([type=checkbox]),#hw-cloud-panel select,#hw-cloud-panel textarea{background:#fff;color:#0f1419;padding:9px;border:1px solid #cbd5df;border-radius:9px;width:100%;font:inherit}#hw-cloud-panel textarea{min-height:68px}
#hw-cloud-panel button{font:inherit;border-radius:10px;border:1px solid #b9c8d5;background:#fff;padding:7px 10px;color:#0f1419;cursor:pointer}#hw-cloud-panel .hw-primary{background:#1d9bf0;color:white;border-color:#1d9bf0}#hw-cloud-panel button:disabled{opacity:.5}
#hw-cloud-panel .hw-mini{font-size:12px;line-height:1.5;color:#536471}#hw-cloud-panel .hw-row{display:flex;gap:7px;align-items:center}#hw-cloud-panel .hw-row>*{flex:1;min-width:0}#hw-cloud-panel label{font-size:12px}#hw-cloud-panel .hw-messages{max-height:270px;overflow:auto;background:#f5f8fa;border-radius:10px;padding:10px;font-size:12px;line-height:1.5;border:1px solid #dbe6ef}#hw-cloud-panel .hw-status{font-size:12px;padding:7px;background:#f4f7fa;border-radius:8px;white-space:pre-wrap}#hw-cloud-panel .hw-inbox-head{display:flex;align-items:center;justify-content:space-between;gap:8px}#hw-cloud-panel .hw-inbox-meta{font-size:12px;background:#f7fbff;border:1px solid #d7e6f3;border-radius:10px;padding:10px;line-height:1.6}#hw-cloud-panel .hw-msg{padding:8px 10px;border-radius:12px;margin:0 0 8px;max-width:92%;width:fit-content;background:#eef4f8}#hw-cloud-panel .hw-msg.user{margin-right:auto;background:#eef4f8}#hw-cloud-panel .hw-msg.character{margin-left:auto;background:#dff0ff}#hw-cloud-panel .hw-msg em{font-style:normal;color:#7a8894}#hw-cloud-panel .hw-msg small{display:block;color:#5c6b76;margin-top:4px;font-size:11px}#hw-cloud-panel details.hw-manual{border:1px solid #e0e8ef;border-radius:10px;padding:8px 10px;background:#fbfdff}#hw-cloud-panel details.hw-manual summary{cursor:pointer;font-weight:700}
#hw-cloud-panel[data-collapsed=true] .hw-body{display:none}#hw-cloud-panel .hw-inbox{display:grid;gap:9px;border-top:1px solid #e5e9ed;padding-top:10px}
`;document.head.append(style);
const cloudShortcut=document.createElement('button');
cloudShortcut.type='button';cloudShortcut.id='hwCloudShortcut';
cloudShortcut.textContent='☁ V27.9 开发者邮箱登录 / 发布';
cloudShortcut.setAttribute('aria-label','打开 V27 云端管理员面板');
cloudShortcut.style.cssText='position:relative;right:auto;top:auto;z-index:3;background:#1d9bf0;color:#fff;border:1px solid #c5e2f5;border-radius:999px;padding:11px 16px;font:700 14px system-ui,-apple-system,sans-serif;box-shadow:0 5px 25px #083b6633;cursor:pointer;max-width:calc(100vw - 28px);';
(document.querySelector('.toolbar-right')||document.body).append(cloudShortcut);
const panel=document.createElement('section');panel.id='hw-cloud-panel';panel.dataset.collapsed='false';panel.innerHTML=`
<div class="hw-head"><h3>☁ V27.9 · 独立开发者登录</h3><button id="hwCloudCollapse" type="button" aria-label="收起云端面板">收起</button></div>
<div class="hw-body"><div class="hw-mini">保留原版主贴与随机评论编辑器（GitHub V39）。只有点击云端发布，游客才会看到更新。</div><div class="hw-mini" style="padding:9px;border:1px solid #d7e9f7;border-radius:10px;background:#f4faff">🔐 当前是<strong>开发者独立登录</strong>。玩家账号在 user.html 使用另一份会话；切换页面不会替换本后台的登录身份。</div>
<div class="hw-status" id="hwCloudStatus">云端连接中…</div>
<div class="hw-mini" style="border:1px solid #d9e5f0;border-radius:10px;padding:9px;background:#f6faff">
  <div style="color:#12649c;font-weight:650">✓ 当前页面就是 GitHub 正式开发者后台</div>
  <div style="margin-top:4px">第一次在新域名使用，请在下方发送开发者邮箱登录链接。登录链接会验证当前浏览器；不同域名的本地草稿、头像不会自动转移。</div>
  </div>
  <div id="hwCloudLogin" style="display:grid;gap:9px">
   <label for="hwCloudEmail">开发者邮箱</label>
   <input id="hwCloudEmail" type="email" autocomplete="username" value="ceciliageng64@gmail.com" placeholder="输入开发者邮箱" title="仅限已授权的开发者邮箱">
   <button id="hwCloudLoginBtn" class="hw-primary" type="button">📩 发送登录链接</button>
   <div class="hw-mini">邮件链接会登录<b>点击它的那台设备</b>。想在电脑上发布，就用电脑浏览器打开 Gmail 并点击最新邮件；手机点击链接只会登录手机。</div>
  </div>
<div id="hwCloudOtherAccount" hidden style="display:grid;gap:8px"><div class="hw-mini">此开发者登录会话未获得管理员权限。可退出此会话并重新使用指定的管理员邮箱登录；不会影响 user.html 的玩家账号。</div><button id="hwCloudOtherSignOut" type="button">退出当前开发者会话</button></div>
<div id="hwCloudAuthTools" hidden><div class="hw-row"><button id="hwCloudPublish" class="hw-primary">☁ 发布当前编辑草稿</button><button id="hwCloudSignOut">退出</button></div><label class="hw-row" style="justify-content:flex-start"><input id="hwCloudAuto" type="checkbox" style="flex:none;width:auto">修改后自动同步（约 5 秒）</label>
<a href="user.html" target="_blank" rel="noopener" style="display:inline-block;margin-top:9px;color:#1d9bf0">打开联网游客页面 ↗</a>
<div class="hw-inbox"><div class="hw-inbox-head"><b>📩 玩家来信</b><button id="hwCloudRefreshInbox" type="button">↻ 刷新玩家来信</button></div><div class="hw-mini">先从“最近来信”里选择一个会话，系统会自动带出玩家和人物；回复时将以该人物身份发送。</div><label for="hwCloudInbox">最近来信</label><select id="hwCloudInbox" aria-label="玩家来信列表"><option value="">加载来信中…</option></select><div id="hwCloudConversationMeta" class="hw-inbox-meta">当前未选择会话。</div><details class="hw-manual"><summary>手动新建 / 切换会话</summary><div style="display:grid;gap:7px;margin-top:8px"><label for="hwCloudVisitor">玩家</label><select id="hwCloudVisitor"><option>加载中…</option></select><label for="hwCloudCharacter">人物</label><select id="hwCloudCharacter"><option>加载中…</option></select><button id="hwCloudOpenDM">查看 / 新建会话</button></div></details><div id="hwCloudMessageList" class="hw-messages">选择用户与角色后可查看消息。</div><textarea id="hwCloudMessageBody" placeholder="以所选角色的身份发消息…"></textarea><div class="hw-row"><input id="hwCloudDMImage" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><button id="hwCloudSendDM" class="hw-primary">发送私信</button></div></div></div>
</div>`;document.body.append(panel);
// V29: the cloud inbox lives in the existing character DM tab, not in this floating panel.
const cloudInboxPanel=panel.querySelector('.hw-inbox');if(cloudInboxPanel)cloudInboxPanel.remove();
const cloudInboxTip=document.createElement('div');cloudInboxTip.className='hw-mini';cloudInboxTip.textContent='玩家来信已移入左侧「私信」视角。切换截图视角账号（例如安吉丽娜）并打开「私信」，即可看到发给该人物的玩家消息。';
$('hwCloudAuthTools')?.append(cloudInboxTip);
// V32 shared cloud timeline: one database row is shown in the public feed, author profile and discussion.
const cloudTimelineBox=document.createElement('section');cloudTimelineBox.id='hwCloudTimelineBox';cloudTimelineBox.className='hw-inbox';
cloudTimelineBox.innerHTML=`<div class="hw-inbox-head"><b>📝 全部帖子 · 统一管理</b><button type="button" id="hwTimelineRefresh">↻ 刷新</button></div><p class="hw-mini">所有人物主贴已移至中间「主贴」视角，玩家发表的主贴不显示在开发端。</p><select id="hwTimelineFilter" aria-label="帖子筛选"><option value="all">所有人的主贴</option><option value="character">人物发布</option><option value="user">玩家发布</option></select><div id="hwTimelineItems">正在读取帖子…</div><div id="hwTimelineDetail"></div>`;
/* Main posts are now managed in the central thread; no extra cloud timeline panel. */
cloudTimelineBox.hidden=true;document.body.append(cloudTimelineBox);
const cloudTimelineStyle=document.createElement('style');cloudTimelineStyle.textContent=`#hwCloudTimelineBox{margin-top:16px;gap:10px}#hwTimelineItems{max-height:340px;overflow:auto;border:1px solid #dbe5ed;border-radius:12px}#hwTimelineItems button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #e9edf1;background:#fff;color:#0f1419;padding:10px;cursor:pointer;line-height:1.5}#hwTimelineItems button:hover,#hwTimelineItems button.active{background:#edf7ff}#hwTimelineItems button small{display:block;color:#536471}#hwTimelineDetail{display:grid;gap:9px}#hwTimelineDetail textarea,#hwTimelineDetail input,#hwTimelineDetail select{width:100%;box-sizing:border-box;border:1px solid #d7e1e8;border-radius:9px;padding:9px;background:#fff;color:#0f1419}#hwTimelineDetail .hw-metric-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#hwTimelineDetail label{display:grid;gap:4px}#hwTimelineDetail .hw-cloud-reply{border:1px solid #e9edf1;border-radius:9px;padding:8px;line-height:1.45}#hwTimelineDetail .hw-cloud-reply small{color:#536471}#hwTimelineDetail .hw-actions{display:flex;gap:8px;flex-wrap:wrap}#hwTimelineDetail .hw-actions button{flex:1;min-width:90px}`;document.head.append(cloudTimelineStyle);
const v32={posts:[],people:new Map(),users:new Map(),selected:'',expanded:false};
window.hwCloudStoryForLegacy=id=>v32.posts.find(p=>p.id===id)?.story_at||null;
// Keep direct cloud edits through subsequent local draft publishing, rather than silently reverting them.
let v32Overrides={};try{v32Overrides=JSON.parse(localStorage.getItem('hw-v32-cloud-overrides')||'{}')||{}}catch{}
function v32RememberOverride(id,body,metrics,created_at){if(!/^v26:/.test(id))return;v32Overrides[id]={body,metrics,created_at};try{localStorage.setItem('hw-v32-cloud-overrides',JSON.stringify(v32Overrides))}catch{}}

const cloudPostText=p=>String(p.body||'').slice(0,130);
function v32PostAuthor(p){if(p.author_kind==='character'){const x=v32.people.get(p.character_id);return x?.name||'人物账号'}return v32.users.get(p.user_id)?.display_name||'玩家';}
function v32RenderPostList(){const shown=v32.posts.filter(p=>!p.parent_id&&p.author_kind==='character');const list=$('hwTimelineItems');if(!list)return;list.innerHTML=shown.map(p=>`<button type="button" data-v32-open="${S(p.id)}" class="${p.id===v32.selected?'active':''}"><b>${S(v32PostAuthor(p))}</b> <small>${S(p.author_kind==='user'?'玩家帖子':'人物帖子')} · ${S(new Date(p.story_at||p.created_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}))}</small>${S(cloudPostText(p)||'[图片]')}</button>`).join('')||'<div style="padding:14px;color:#536471">这里还没有帖子。</div>'}
function v32Metrics(p){return ['replies','reposts','likes','views','bookmarks'].map((key,i)=>{const names=['评论','转发','喜欢','浏览','书签'];return `<label>${names[i]}<input data-v32-metric="${key}" value="${S(String(p.metrics?.[key]||'0'))}" maxlength="25"></label>`}).join('')}
function v32RenderDetail(){const box=$('hwTimelineDetail'),p=v32.posts.find(p=>p.id===v32.selected);if(!box)return;if(!p){box.innerHTML='<small class="hw-mini">点击上面的帖子查看评论及编辑选项。</small>';return;}const child=v32.posts.filter(x=>x.parent_id===p.id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)),isChar=p.author_kind==='character';const chars=[...v32.people].map(([id,c])=>`<option value="${S(id)}" ${id===p.character_id?'selected':''}>${S(c.name)}</option>`).join('');box.innerHTML=`<div class="hw-inbox-meta"><b>${S(v32PostAuthor(p))}</b> · ${S(p.author_kind==='user'?'玩家帖子（不可代替玩家编辑）':'人物帖子')}<br><small>同一条帖子在首页、作者主页和详情里共享内容。</small></div><label>正文<textarea id="v32Body" rows="4" ${isChar?'':'readonly'}>${S(p.body||'')}</textarea></label>${`<div class="hw-metric-grid">${v32Metrics(p)}</div><div class="hw-actions"><button type="button" id="v32Save" class="hw-primary">${isChar?'保存正文和互动数字':'保存玩家帖互动数字'}</button>${isChar?'<button type="button" id="v32Delete">删除人物帖子</button>':''}</div>`}<b style="font-size:13px">评论 · ${child.length} 条</b><div id="v32Comments">${child.map(x=>`<div class="hw-cloud-reply"><b>${S(v32PostAuthor(x))}</b>：${S(x.body||'[图片]')}<small> ${S(new Date(x.story_at||x.created_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}))}</small></div>`).join('')||'<span class="hw-mini">暂无评论。</span>'}</div><label>选择评论人物<select id="v32ReplyCharacter">${chars}</select></label><label>评论内容<textarea id="v32ReplyText" rows="3" placeholder="输入评论，或点随机生成…"></textarea></label><div class="hw-actions"><button type="button" id="v32RandomReply">🎲 随机评论</button><button type="button" id="v32SendReply" class="hw-primary">发布人物评论</button></div>`;
}

/* Cloud-backed historical time editor. Does not touch author, post body or media. */
const hwTimePanel=document.createElement("details");
hwTimePanel.className="hw-story";
hwTimePanel.innerHTML='<summary>🕰 历史发布时间（云端管理）</summary><p class="hw-mini">现有旧帖及评论已自动安排了历史时间。这里可以修改存疑的时间；随机时间自动遵守回复关系。仅改变时间，不重新发送通知。</p><div id="hwStoryTimeList">读取历史时间中…</div>';
$("hwCloudAuthTools")?.append(hwTimePanel);
const hwStoryCSS=document.createElement("style");
hwStoryCSS.textContent='#hwCloudAuthTools .hw-story{margin-top:12px;padding:10px;border:1px solid #d9e4ef;border-radius:10px;background:#fff}#hwCloudAuthTools .hw-story summary{font-weight:700;cursor:pointer;font-size:13px}#hwStoryTimeList{max-height:390px;overflow:auto;padding-top:5px}#hwStoryTimeList .hw-story-row{border-bottom:1px solid #edf1f5;padding:8px 0}#hwStoryTimeList .hw-story-row small{display:block;line-height:1.45;color:#536471;overflow-wrap:anywhere}#hwStoryTimeList .hw-story-row .hw-story-head{display:flex;align-items:center;justify-content:space-between;gap:7px}#hwStoryTimeList .hw-story-row .hw-story-head b{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#hwStoryTimeList .hw-story-row .hw-story-actions{display:flex;align-items:center;gap:4px;flex:none}#hwStoryTimeList .hw-story-row .hw-story-actions button{padding:4px 6px;font-size:11px}';
document.head.append(hwStoryCSS);
function hwCloudStoryMs(p){const time=Date.parse(p?.story_at||"");if(Number.isFinite(time))return time;
 const legacy=Date.parse(p?.created_at||"");if(!Number.isFinite(legacy))return 0;
 const d=new Date(legacy);d.setFullYear(d.getFullYear()-33);return d.getTime();}
function hwCloudWorldNow(){const d=new Date();d.setFullYear(d.getFullYear()-33);return d.getTime();}
function hwCloudStoryText(p){const ms=hwCloudStoryMs(p);return ms?new Date(ms).toLocaleString("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}):"未安排";}
function hwCloudStoryBounds(p){
 let low=Date.parse("1993-11-01T08:00:00Z"),high=hwCloudWorldNow();
 for(const id of [p.parent_id,p.quote_id]){const target=v32.posts.find(x=>x.id===id);if(target)low=Math.max(low,hwCloudStoryMs(target)+1000);}
 for(const x of v32.posts)if(x.parent_id===p.id||x.quote_id===p.id)high=Math.min(high,hwCloudStoryMs(x)-1000);
 return {low,high};
}
function hwCloudRenderStoryList(){
 const list=$("hwStoryTimeList");if(!list||!admin)return;
 const roots=v32.posts.filter(x=>!x.parent_id).sort((a,b)=>hwCloudStoryMs(b)-hwCloudStoryMs(a));
 const children=new Map();for(const p of v32.posts)if(p.parent_id){const a=children.get(p.parent_id)||[];a.push(p);children.set(p.parent_id,a);}
 const rows=[],seen=new Set();
 function draw(p,level){
  if(!p||seen.has(p.id))return;seen.add(p.id);
  const name=v32PostAuthor(p),canWrite=p.author_kind==="character";
  const time=hwCloudStoryText(p);
  rows.push('<div class="hw-story-row" style="padding-left:'+Math.min(level,4)*7+'px">'
    +'<div class="hw-story-head"><b>'+(level?"↳ ":"")+S(name)+'</b><div class="hw-story-actions"><button type="button" data-hw-story="edit" data-id="'+S(p.id)+'" '+(canWrite?'':'disabled title="玩家帖子受账号权限保护"')+'>✎ 时间</button><button type="button" data-hw-story="random" data-id="'+S(p.id)+'" '+(canWrite?'':'disabled')+'>🎲</button></div></div>'
    +'<small>'+S(time)+' · '+S((p.body||"[图片]").slice(0,75))+'</small></div>');
  const kids=(children.get(p.id)||[]).sort((a,b)=>hwCloudStoryMs(a)-hwCloudStoryMs(b));
  for(const item of kids)draw(item,level+1);
 }
 for(const root of roots)draw(root,0);
 list.innerHTML='<p class="hw-mini">所有云端主帖与回复 · '+v32.posts.length+'条。人物帖及评论可修改；玩家帖只保留自动安排的历史时间。</p>'+rows.join("");
}
async function hwCloudAdjustTime(action,id){
 if(!admin)throw Error("需要开发者权限");
 const p=v32.posts.find(x=>x.id===id);if(!p||p.author_kind!=="character")throw Error("这条内容没有开发者修改权限");
 const {low,high}=hwCloudStoryBounds(p);if(high<low)throw Error("现有父帖与回复时间冲突，无法随机。请先调整有关内容");
 let time;
 if(action==="random"){
  const fraction=p.parent_id?Math.pow(Math.random(),2.1):Math.random();
  time=low+(high-low)*fraction;
 }else{
  const original=hwCloudStoryText(p);
  const input=prompt("填写1993年的故事时间，例如 1993-11-15 19:42\n有效范围："+new Date(low).toLocaleString("zh-CN")+" 至 "+new Date(high).toLocaleString("zh-CN"),original.replace(/[年月]/g,"-").replace("日","").replace(/\//g,"-"));
  if(input===null)return;
  const hit=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(input.trim());
  if(!hit)throw Error("请输入 1993-11-15 19:42 这样的格式");
  const [,year,month,day,hour,minute,second]=hit.map((x,i)=>i?Number(x):x);
  const d=new Date(year,month-1,day,hour,minute,second||0);
  if(year<1993||d.getFullYear()!==year||d.getMonth()!==month-1||d.getDate()!==day)throw Error("日期无效或早于霍格沃茨起点");
  time=d.getTime();
 }
 if(time<low||time>high)throw Error("时间超出合法范围：不能早于父评论或晚于已存在的回复，也不能超过当前世界时间");
 const iso=new Date(time).toISOString();
 const result=await u().from("hw_posts").update({story_at:iso}).eq("id",id).eq("author_kind","character").select("id,story_at");
 if(result.error)throw result.error;if(!result.data?.length)throw Error("云端没有保存变更，请检查权限");
 await v32Reload();
 status("✅ 历史发布时间已更新，作者、正文和原始公开时间保持不变。");
}
$("hwStoryTimeList").addEventListener("click",e=>{
 const btn=e.target.closest("[data-hw-story]");if(!btn)return;
 btn.disabled=true;
 hwCloudAdjustTime(btn.dataset.hwStory,btn.dataset.id)
  .catch(err=>{status("时间未修改："+(err.message||String(err)));alert(err.message||String(err))})
  .finally(()=>{btn.disabled=false});
});


// A narrow bridge for the EXISTING developer timeline; no second homepage is created.
// Follow the actual cloud parent chain, including rows outside the limited local cache.
async function hwDevCloudRootId(row){
 const visited=new Set();
 let current=row;
 for(let depth=0;current&&depth<100;depth++){
  if(visited.has(current.id))throw Error('评论回复关系存在循环');
  visited.add(current.id);
  if(!current.parent_id)return current.id;
  const nextId=current.parent_id;
  current=v32.posts.find(p=>p.id===nextId);
  if(!current){
   const {data,error}=await u().from('hw_posts').select('id,parent_id').eq('id',nextId).maybeSingle();
   if(error)throw error;
   if(!data)throw Error('回复对象的上级评论不存在');
   current=data;
  }
 }
 throw Error('评论回复关系异常');
}


window.hwDevCloudFeed={
 list:()=>v32.posts.filter(p=>!p.parent_id).map(p=>{
  const person=p.author_kind==='character'?v32.people.get(p.character_id):v32.users.get(p.user_id);
  return {...p,authorName:person?.name||person?.display_name||'玩家',authorHandle:person?.handle||'',authorAvatar:person?.avatar_url||'',
   time:hwCloudStoryText(p),sortTime:hwCloudStoryMs(p),replyCount:v32.posts.filter(x=>x.parent_id===p.id).length};
 }).sort((a,b)=>b.sortTime-a.sortTime),
 replies:id=>{const result=[],seen=new Set();function walk(parent){for(const p of v32.posts.filter(x=>x.parent_id===parent).sort((a,b)=>hwCloudStoryMs(a)-hwCloudStoryMs(b))){if(seen.has(p.id))continue;seen.add(p.id);const a=p.author_kind==='character'?v32.people.get(p.character_id):v32.users.get(p.user_id);result.push({...p,authorName:v32PostAuthor(p),authorHandle:a?.handle||'',time:hwCloudStoryText(p)});walk(p.id)}}walk(id);return result;},
 reply:id=>{const p=v32.posts.find(x=>x.id===id);if(!p)return null;const a=p.author_kind==='character'?v32.people.get(p.character_id):v32.users.get(p.user_id);return {...p,authorName:v32PostAuthor(p),authorHandle:a?.handle||''};},
 playerReplies:id=>v32.posts.filter(x=>x.user_id===id&&x.parent_id).map(p=>{let root=p,seen=new Set();while(root?.parent_id&&!seen.has(root.id)){seen.add(root.id);root=v32.posts.find(x=>x.id===root.parent_id)}return {...p,authorName:v32PostAuthor(p),authorHandle:v32.users.get(id)?.handle||'',time:hwCloudStoryText(p),sortTime:hwCloudStoryMs(p),rootPostId:root?.id||p.parent_id,replyCount:0}}).sort((a,b)=>b.sortTime-a.sortTime),
 player:id=>v32.users.get(id),
 characters:()=>[...v32.people.values()].filter(p=>p.id&&p.name).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')),
 sendReply:async(id,characterId,body,parentId='',imageFile=null)=>{
  if(!admin)throw Error('请先登录开发者账号');
  const post=v32.posts.find(p=>p.id===id&&!p.parent_id),person=v32.people.get(characterId);
  if(!post)throw Error('帖子不存在或已被删除');
  if(!person)throw Error('请选择有效的人物');
  const text=String(body||'').trim();if(!text&&!imageFile)throw Error('评论不能为空');
  if(parentId){
   let parent=v32.posts.find(p=>p.id===parentId);
   if(!parent){const {data,error}=await u().from('hw_posts').select('id,parent_id').eq('id',parentId).maybeSingle();if(error)throw error;parent=data;}
   if(!parent||await hwDevCloudRootId(parent)!==id)throw Error('回复对象不属于本帖');
  }
  const imageUrl=imageFile?await H.uploadPublic(imageFile,'admin'):null;
  const {error}=await u().from('hw_posts').insert({id:'v32:'+crypto.randomUUID(),author_kind:'character',character_id:person.id,user_id:null,parent_id:parentId||id,quote_id:null,body:text,image_url:imageUrl,language:post.language||'zh',metrics:{likes:'0',replies:'0',reposts:'0',views:'0',bookmarks:'0'}});
  if(error)throw error;
  await v32Reload();
 },
 editReply:async(id,body,characterId,parentId)=>{
  if(!admin)throw Error('需要开发者账号');
  const p=v32.posts.find(x=>x.id===id&&x.parent_id&&x.author_kind==='character');
  if(!p)throw Error('仅能编辑人物评论');
  if(!v32.people.has(characterId))throw Error('请选择有效人物');
  let parent=v32.posts.find(x=>x.id===parentId);
  if(!parent){const {data,error}=await u().from('hw_posts').select('id,parent_id').eq('id',parentId).maybeSingle();if(error)throw error;parent=data;}
  if(!parent||parent.id===id)throw Error('回复对象无效');
  const root=await hwDevCloudRootId(p);
  if(await hwDevCloudRootId(parent)!==root)throw Error('回复对象不属于本帖');
  // A comment cannot become a child of its own descendants.
  let cursor=parent;const seen=new Set();
  while(cursor?.parent_id){
   if(cursor.id===id||seen.has(cursor.id))throw Error('不能回复自己的下级评论');
   seen.add(cursor.id);
   const next=cursor.parent_id;
   cursor=v32.posts.find(x=>x.id===next);
   if(!cursor){const {data,error}=await u().from('hw_posts').select('id,parent_id').eq('id',next).maybeSingle();if(error)throw error;cursor=data;}
  }
  const {data,error}=await u().from('hw_posts').update({body:String(body).trim(),character_id:characterId,parent_id:parentId}).eq('id',id).eq('author_kind','character').select('id');
  if(error)throw error;if(!data?.length)throw Error('没有修改权限');
  await v32Reload();
 },
 deleteReply:async id=>{
  if(!admin)throw Error('需要开发者账号');
  const p=v32.posts.find(x=>x.id===id&&x.parent_id);if(!p)throw Error('这条评论不存在');
  const {data,error}=await u().from('hw_posts').delete().eq('id',id).not('parent_id','is',null).select('id');
  if(error)throw error;if(!data?.length)throw Error('没有删除权限');
  await v32Reload();
 },
 saveMetrics:async(id,metrics)=>{
  if(!admin)throw Error('需要开发者账号');
  const p=v32.posts.find(x=>x.id===id);if(!p)throw Error('找不到帖子');
  const {data,error}=await u().rpc('hw_admin_set_post_metrics',{p_post_id:id,p_metrics:metrics});
  if(error)throw error;if(!data)throw Error('互动数字没有保存');
  await v32Reload();
 },
 select:id=>{v32.selected=id;v32RenderPostList();v32RenderDetail();},
 refresh:()=>v32Reload()
};

async function v32Reload(){if(!admin)return;const[posts,people,users]=await Promise.all([u().from('hw_posts').select('*').order('story_at',{ascending:false}).limit(3000),u().from('hw_characters').select('id,name,handle,avatar_url,badge_type').limit(1000),u().from('hw_profiles').select('id,display_name,handle,avatar_url,cover_url,bio,location,joined_label,badge_type').limit(1000)]);for(const x of [posts,people,users])if(x.error)throw x.error;v32.posts=posts.data||[];v32.people=new Map((people.data||[]).map(x=>[x.id,x]));v32.users=new Map((users.data||[]).map(x=>[x.id,x]));v32RenderPostList();v32RenderDetail();hwCloudRenderStoryList();window.dispatchEvent(new Event('hw-dev-cloud-refreshed'));if(!v33RenderAllPosts()&&!$('v33-feed')?.contains(document.activeElement))v33RefreshView();}
$('hwTimelineRefresh').onclick=()=>v32Reload().catch(e=>status('读取帖子失败：'+H.errMsg(e)));
$('hwTimelineFilter').onchange=v32RenderPostList;
$('hwTimelineItems').onclick=e=>{const b=e.target.closest('[data-v32-open]');if(!b)return;v32.selected=b.dataset.v32Open;v32RenderPostList();v32RenderDetail();};
$('hwTimelineDetail').onclick=async e=>{const action=e.target.closest('button')?.id;if(!action)return;const p=v32.posts.find(x=>x.id===v32.selected);if(!p)return;const button=e.target.closest('button');button.disabled=true;try{
 if(action==='v32RandomReply'){$('v32ReplyText').value=['我真的笑出声了😭','不是吧，怎么连这里也开始吵起来了💀','等一下，这事我得问问凯蒂。','格兰芬多表示我们有话要说🦁','这个我支持，但训练还是不能迟到🙂','这条得留着，等比赛结束再看。'][Math.floor(Math.random()*6)];return;}
 if(action==='v32Save'){const metrics={...(p.metrics||{})};for(const input of $('hwTimelineDetail').querySelectorAll('[data-v32-metric]'))metrics[input.dataset.v32Metric]=input.value.trim()||'0';if(p.author_kind==='character'){const body=$('v32Body').value.trim();const{error}=await u().from('hw_posts').update({body,metrics}).eq('id',p.id).eq('author_kind','character');if(error)throw error;v32RememberOverride(p.id,body,metrics);status('人物帖子正文和互动数字已更新。');}else{const{error}=await u().rpc('hw_admin_set_post_metrics',{p_post_id:p.id,p_metrics:metrics});if(error)throw error;status('玩家帖互动数字已更新；玩家正文保持不变。');}}
 if(action==='v32Delete'){if(p.author_kind!=='character'||!confirm('确定删除这条人物帖子及其评论吗？此操作无法撤销。'))return;const{error}=await u().from('hw_posts').delete().eq('id',p.id).eq('author_kind','character');if(error)throw error;delete v32Overrides[p.id];try{localStorage.setItem('hw-v32-cloud-overrides',JSON.stringify(v32Overrides))}catch{}v32.selected='';status('帖子已从云端删除。');}
 if(action==='v32SendReply'){const body=$('v32ReplyText').value.trim(),character_id=$('v32ReplyCharacter').value;if(!body||!character_id)throw Error('请选择角色并输入评论');const {error}=await u().from('hw_posts').insert({id:'v32:'+crypto.randomUUID(),author_kind:'character',character_id,user_id:null,parent_id:p.id,quote_id:null,body,language:p.language||'zh',metrics:{likes:'0',replies:'0',reposts:'0',views:'0',bookmarks:'0'}});if(error)throw error;status('✅ 角色评论已发布，玩家刷新后即可看到。');}
 await v32Reload();
 }catch(err){status('帖子操作失败：'+H.errMsg(err))}finally{button.disabled=false;}};


/* V35: keep the original native post/reply editor. */
function v33RenderAllPosts(){return false;}
function v33RefreshView(){}

let hwCloudLoading=false;
async function refreshIntegratedDM(){
 if(!admin||!u()||!window.hwCloudDMUpdate||hwCloudLoading)return;
 hwCloudLoading=true;
 try{
  const [convos,people,profiles,msgs]=await Promise.all([
   u().from('hw_conversations').select('id,user_id,character_id,created_at').order('created_at',{ascending:false}).limit(500),
   u().from('hw_characters').select('id,name,handle').limit(1000),
   u().from('hw_profiles').select('id,display_name,handle,avatar_url').limit(1000),
   u().from('hw_messages').select('*').order('created_at',{ascending:false}).limit(2500)
  ]);
  for(const res of [convos,people,profiles,msgs])if(res.error)throw res.error;
  const byPerson=new Map((people.data||[]).map(x=>[String(x.id),x])),byUser=new Map((profiles.data||[]).map(x=>[String(x.id),x]));
  const grouped=new Map();for(const m of msgs.data||[]){if(!grouped.has(m.conversation_id))grouped.set(m.conversation_id,[]);grouped.get(m.conversation_id).push(m)}
  const rows=[];
  for(const c of convos.data||[]){const messages=(grouped.get(c.id)||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));if(!messages.length)continue;
   const user=byUser.get(String(c.user_id)),char=byPerson.get(String(c.character_id));
   rows.push({id:c.id,character_id:String(c.character_id),playerName:user?.display_name||user?.handle||'玩家',avatar_url:user?.avatar_url||'',characterName:char?.name||'人物',messages:messages.map(m=>({sender_kind:m.sender_kind,body:m.body||'',time:new Date(m.created_at).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}),image_url:m.image_url||'',image_resolved:m.image_url&&!String(m.image_url).startsWith('private:')?m.image_url:'',recalled:!!m.recalled}))});
  }
  await Promise.all(rows.flatMap(c=>c.messages.filter(m=>m.image_url?.startsWith('private:')).map(async m=>{
    try{m.image_resolved=await H.signedPrivate(m.image_url);}catch(e){console.warn('私信附件暂无法预览',e);}
  })));
  window.hwCloudDMUpdate(rows.sort((a,b)=>new Date(grouped.get(b.id)?.at(-1)?.created_at||0)-new Date(grouped.get(a.id)?.at(-1)?.created_at||0)));
 }catch(e){status('私信同步失败：'+H.errMsg(e));console.warn(e)}finally{hwCloudLoading=false}
}
window.hwCloudIsAdmin=()=>admin;
window.hwCloudDMClear=async(conversationId)=>{
 if(!admin||!await H.isAdmin())throw Error('只有开发者管理员可以清空真实私信');
 const {data:convo,error:lookupError}=await u().from('hw_conversations').select('id,character_id').eq('id',conversationId).maybeSingle();
 if(lookupError||!convo)throw Error('找不到这段会话');
 if(String(window.hwCloudDmViewer?.())!==String(convo.character_id))throw Error('当前人物与收件人不一致，请重新选择会话');
 const {error}=await u().from('hw_messages').delete().eq('conversation_id',conversationId);
 if(error)throw error;
 const {count, error:checkError}=await u().from('hw_messages').select('id',{count:'exact',head:true}).eq('conversation_id',conversationId);
 if(checkError)throw checkError;
 if(count)throw Error('删除后仍有 '+count+' 条消息，请刷新后检查');
 await refreshIntegratedDM();
 status('✅ 当前会话消息已清空，其他人物和玩家会话未改动');
};
window.hwCloudDMDeleteConversation=async(conversationId)=>{
 if(!admin||!await H.isAdmin())throw Error('只有开发者管理员可以删除玩家私信会话');
 const {data:convo,error:lookupError}=await u().from('hw_conversations').select('id,character_id').eq('id',conversationId).maybeSingle();
 if(lookupError)throw lookupError;
 if(!convo)throw Error('这段会话已经不存在，请刷新');
 if(String(window.hwCloudDmViewer?.())!==String(convo.character_id))throw Error('请先切换到该会话所属的人物');
 // Database FK hw_messages_conversation_id_fkey ON DELETE CASCADE ensures messages vanish as well.
 const {data:removed,error:deleteError}=await u().from('hw_conversations').delete().eq('id',conversationId).select('id');
 if(deleteError)throw deleteError;
 if(!removed?.some(x=>x.id===conversationId))throw Error('未获得删除权限，云端会话未更改');
 const {data:left,error:verifyError}=await u().from('hw_conversations').select('id').eq('id',conversationId).maybeSingle();
 if(verifyError)throw verifyError;
 if(left)throw Error('云端仍有这段会话，请刷新页面核对');
 hwCloudView.rows=hwCloudView.rows.filter(row=>row.id!==conversationId);
 hwCloudView.selected='';
 window.hwCloudDMUpdate?.(hwCloudView.rows);
 await refreshIntegratedDM();
 status('✅ 已删除当前整段真实玩家私信');
};
window.hwCloudDMSend=async(conversationId,body,file=null)=>{
 if(!admin)throw Error('请先登录开发者账号');
 const convo=(await u().from('hw_conversations').select('id,character_id').eq('id',conversationId).maybeSingle());
 if(convo.error||!convo.data)throw Error('没有找到该会话');
 const viewer=window.hwCloudDmViewer?.();
 if(String(viewer)!==String(convo.data.character_id))throw Error('当前登录人物不是这段会话的收件人，请切换角色');
 if(!String(body||'').trim()&&!file)throw Error('请填写消息或添加图片');
 const image_url=file?await H.uploadPrivate(file,conversationId):null;
 const res=await u().from('hw_messages').insert({conversation_id:conversationId,sender_kind:'character',body:body||'',image_url});
 if(res.error)throw res.error;
 await refreshIntegratedDM();status('✅ 已通过当前人物的私信发送给玩家。');
};

cloudShortcut.onclick=()=>{panel.hidden=!panel.hidden;cloudShortcut.textContent=panel.hidden?'☁ 打开 V27 云端管理':'☁ V27.9 开发者邮箱登录 / 发布';};
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){panel.hidden=true;cloudShortcut.textContent='☁ 打开 V27 云端管理';}});
$('hwCloudCollapse').onclick=()=>{panel.dataset.collapsed=panel.dataset.collapsed==='true'?'false':'true';$('hwCloudCollapse').textContent=panel.dataset.collapsed==='true'?'展开':'收起'};
function status(t){$('hwCloudStatus').textContent=t}
function busyState(v){busy=v;if($('hwCloudPublish'))$('hwCloudPublish').disabled=v;if($('hwCloudSendDM'))$('hwCloudSendDM').disabled=v}
function personIdByPost(post,people){const h=String(post.handle||'').toLowerCase();const alias={pucey7:'adrianpucey',blaise:'blaisezabini',flint_7:'marcusflint',ced:'cedricdiggory',rd_01:'rogerdavies',fw_wtf:'fredweasley',notfred:'georgeweasley'};
 return people.find(p=>String(p.handle).toLowerCase()===h)?.id||people.find(p=>String(p.handle).toLowerCase()===(alias[h]||''))?.id||people.find(p=>String(p.name)===String(post.name))?.id||null;}
// Incremental publishing: store only compact fingerprints, not entire images or posts.
const HW_PUBLISH_HASH_KEY='hw-cloud-published-hashes-v1';
const HW_IMAGE_URL_KEY='hw-cloud-uploaded-images-v1';
function hwPublishFingerprint(data){
 const str=typeof data==='string'?data:JSON.stringify(data);
 let h=2166136261;
 for(let i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);
 return str.length+':'+(h>>>0).toString(36);
}
function hwLoadPublishCache(key){try{const v=JSON.parse(localStorage.getItem(key)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{return {}}}
function hwSavePublishCache(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(e){console.warn('增量同步缓存无法持久化，下次可能需要完整同步',e)}}
const imageCache=new Map();
const hwCloudImageUrlCache=hwLoadPublishCache(HW_IMAGE_URL_KEY);
async function cloudImage(src){if(!src||typeof src!=='string')return null;if(src.startsWith('https://'))return src;if(imageCache.has(src))return imageCache.get(src);if(!src.startsWith('data:image/'))return null;
 const fingerprint=hwPublishFingerprint(src);
 if(hwCloudImageUrlCache[fingerprint]){imageCache.set(src,hwCloudImageUrlCache[fingerprint]);return hwCloudImageUrlCache[fingerprint]}
 let blob;
 if(src.startsWith('data:image/svg+xml')){
  // Generated media illustrations are SVG data URLs. Convert to JPEG before
  // uploading so Supabase storage and the player feed display the same media.
  const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('SVG 素材无法转换，请重新生成'));image.src=src});
  const canvas=document.createElement('canvas');canvas.width=Math.min(1400,img.naturalWidth||900);canvas.height=Math.min(1400,img.naturalHeight||540);
  const context=canvas.getContext('2d');if(!context)throw Error('浏览器不能转换图片');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
  blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('SVG 图片转换失败')),'image/jpeg',.9));
 }else blob=H.imageBlobFromDataUrl(src);
 const url=await H.uploadPublic(blob,'admin');imageCache.set(src,url);
 hwCloudImageUrlCache[fingerprint]=url;hwSavePublishCache(HW_IMAGE_URL_KEY,hwCloudImageUrlCache);
 return url;}
function legacyCreatedAt(time,existing){if(existing)return existing;const text=String(time||''),now=Date.now();let mins=180;
 const seconds=/([\d.]+)\s*(?:秒|s(?:ec)?\b)/i.exec(text);const minutes=/([\d.]+)\s*(?:分钟|m\b)/i.exec(text);const hours=/([\d.]+)\s*(?:小时|h\b)/i.exec(text);if(seconds)mins=Number(seconds[1])/60;else if(minutes)mins=Number(minutes[1]);else if(hours)mins=Number(hours[1])*60;else if(/刚刚|now|just now/i.test(text))mins=0;
 return new Date(now-mins*60000).toISOString();}
// Map the editor's display spelling to the canonical PostgreSQL CHECK values.
// The editor uses `gray`; Supabase schema.sql intentionally stores `grey`.
function cloudBadgeType(value,verified=true){
 if(!verified)return 'none';
 const raw=String(value||'blue').toLowerCase();
 const canonical=raw==='gray'?'grey':raw;
 return ['blue','gold','grey','affiliate'].includes(canonical)?canonical:'blue';
}
async function publish(){
 if(busy||!admin)return;if(typeof window.hwLegacySnapshot!=='function'){status('本地草稿未初始化');return;}
 busyState(true);
 try{
  const snapshot=window.hwLegacySnapshot();const people=(snapshot.people||[]).filter(p=>String(p.handle).toLowerCase()!=='my_account');
  const previous=hwLoadPublishCache(HW_PUBLISH_HASH_KEY);
  const forceFull=localStorage.getItem('hw-gh-migration-first-publish')==='1';
  const previousPosts=previous.posts||{},previousChars=previous.characters||{};
  const nextPostHashes={},nextCharacterHashes={};
  const desiredPostIds=new Set();
  let reusedPosts=0,reusedCharacters=0;
  status('正在准备人物资料…');
  const chars=[];const handles=new Set();const ids=new Set();
  for(const p of people){if(!p.id||!p.handle||!p.name||handles.has(p.handle.toLowerCase())||ids.has(p.id))continue;handles.add(p.handle.toLowerCase());ids.add(p.id);
   const page=snapshot.profilePages?.[p.id]||{};
   const characterFingerprint=hwPublishFingerprint({p,page});
   nextCharacterHashes[p.id]=characterFingerprint;
   if(!forceFull&&previousChars[p.id]===characterFingerprint){reusedCharacters++;continue;}
   chars.push({id:p.id,handle:p.handle,name:p.name,avatar_url:await cloudImage(p.avatar),cover_url:await cloudImage(page.cover),bio:page.bio||'',location:page.location||'Hogwarts',joined_label:page.joined||'1991年9月',badge_type:cloudBadgeType(p.badgeType,p.verified),meta:{following:page.following,followers:page.followers}});
  }
  // Public directory membership: exactly the developer's saved People library,
  // never anonymous/random commenters later added for post author rendering.
  const publishedCastIds=[...ids];
  // Comments by random visitors may not live in the saved character directory.
  // Preserve their author identities in the cloud without modifying the V26 directory.
  for(const lang of ['zh','en']){
    const doc=snapshot.drafts?.[lang]||{};
    const extras=[doc.post,...(doc.replies||[]),...(doc.quotes||[])].filter(Boolean);
    for(const bank of [snapshot.profilePosts?.[lang]||{},snapshot.profileReposts?.[lang]||{}])for(const by of Object.values(bank)){extras.push(...(by||[]));for(const post of by||[])extras.push(...(post.hwThread?.replies||[]),...(post.hwThread?.quotes||[]));}
    for(const row of extras){
      if(!row?.handle||personIdByPost(row,people))continue;
      const handle=String(row.handle).replace(/^@/,'').trim().toLowerCase();
      if(!handle||handle==='my_account'||handles.has(handle))continue;
      const fallback={id:'legacy_commenter_'+handle.replace(/[^a-z0-9_]/g,'').slice(0,52),name:row.name||handle,handle,avatar:row.avatar||'',verified:!!row.verified,badgeType:row.badgeType||'blue'};
      if(!fallback.id||ids.has(fallback.id))continue;
      people.push(fallback);ids.add(fallback.id);handles.add(handle);
      const extraFingerprint=hwPublishFingerprint(fallback);
      nextCharacterHashes[fallback.id]=extraFingerprint;
      if(!forceFull&&previousChars[fallback.id]===extraFingerprint){reusedCharacters++;continue;}
      chars.push({id:fallback.id,handle:fallback.handle,name:fallback.name,avatar_url:await cloudImage(fallback.avatar),cover_url:null,bio:'',location:'Hogwarts',joined_label:'1991年9月',badge_type:cloudBadgeType(fallback.badgeType,fallback.verified),meta:{}});
    }
  }
  const docPostRows=[];const existingResp=await u().from('hw_posts').select('id,source_key,created_at,story_at,published_at').like('source_key','v26:%').limit(5000);
  if(existingResp.error)throw existingResp.error;const existing=new Map((existingResp.data||[]).map(row=>[row.id,row]));
  async function createPost(src,lang,key,authorId,parentId=null,quoteId=null){if(!authorId)return;
   const id='v26:'+key,old=existing.get(id);
   desiredPostIds.add(id);
   const fingerprint=hwPublishFingerprint({src,lang,key,authorId,parentId,quoteId});
   nextPostHashes[id]=fingerprint;
   if(old&&!forceFull&&previousPosts[id]===fingerprint){reusedPosts++;return;}
   const metrics={replies:src.replies||'0',reposts:src.reposts||'0',likes:src.likes||'0',views:src.views||'0',bookmarks:src.bookmarks||'0',time_label:src.time||''};
   // Editor reposts contain an embedded quote (including a picture). Preserve it in
   // the cloud post's metrics so it can be rendered without creating a fake feed post.
   if(src.isRepost&&src.quote&&typeof src.quote==='object'){
    const q=src.quote;
    metrics.quote_snapshot={author_id:String(q.authorId||''),author_name:String(q.authorName||''),author_handle:String(q.authorHandle||''),author_verified:!!q.authorVerified,text:String(q.text||'').slice(0,12000),image_url:await cloudImage(q.media),time_label:String(q.time||'')};
   }
   docPostRows.push({id,source_key:id,author_kind:'character',character_id:authorId,user_id:null,parent_id:parentId,quote_id:quoteId,body:String(src.text||'').slice(0,12000),image_url:await cloudImage(src.media),language:lang,metrics,created_at:legacyCreatedAt(src.time,old?.created_at),story_at:src.hwStoryAt||old?.story_at||null,published_at:old?.published_at||new Date().toISOString()});
  }
  // main posts first: comment foreign keys rely on them
  for(const lang of ['zh','en']){const doc=snapshot.drafts?.[lang];if(!doc?.post)continue;const charId=personIdByPost(doc.post,people);await createPost(doc.post,lang,lang+':main',charId,null)}
  status('准备主页动态和评论…');
  for(const lang of ['zh','en']){
   for(const [personId,rows] of Object.entries(snapshot.profilePosts?.[lang]||{})){
    if(!ids.has(personId))continue;for(const [idx,post] of (rows||[]).entries()){
     await createPost(post,lang,`${lang}:profile:${personId}:${post.id||idx}`,personId,null);
    }
   }
  }
  for(const lang of ['zh','en']){for(const [personId,rows] of Object.entries(snapshot.profileReposts?.[lang]||{})){
   if(!ids.has(personId))continue;
   for(const [idx,post] of (rows||[]).entries())await createPost(post,lang,`${lang}:repost:${personId}:${post.id||idx}`,personId,null);
  }}
  for(const lang of ['zh','en']){
   const doc=snapshot.drafts?.[lang];if(!doc)continue;const source=doc.replies||[];
   const byId=new Map(source.map(r=>[String(r.id),r]));const emitted=new Set();
   async function emit(r,stack=new Set()){
    const key=String(r.id);if(emitted.has(key)||stack.has(key))return;stack.add(key);
    if(r.parentId&&byId.has(String(r.parentId)))await emit(byId.get(String(r.parentId)),stack);
    const charId=personIdByPost(r,people);const parent=(r.parentId&&byId.has(String(r.parentId)))?'v26:'+lang+':reply:'+r.parentId:'v26:'+lang+':main';
    await createPost(r,lang,lang+':reply:'+key,charId,parent);emitted.add(key);
   }
   for(const r of source)await emit(r);
   for(const [idx,q] of (doc.quotes||[]).entries())await createPost(q,lang,lang+':quote:'+(q.id||idx),personIdByPost(q,people),null,'v26:'+lang+':main');
   // Original native random commenter generator on each individual profile main post.
   for(const [bankKind,bank] of [['profile',snapshot.profilePosts?.[lang]||{}],['repost',snapshot.profileReposts?.[lang]||{}]])for(const [owner,posts] of Object.entries(bank)){
    if(!ids.has(owner))continue;
    for(const [idx,post] of (posts||[]).entries()){
     const postKey=`${lang}:${bankKind}:${owner}:${post.id||idx}`,rootId='v26:'+postKey;
     const replies=post.hwThread?.replies||[];const all=new Map(replies.map(r=>[String(r.id),r]));const seen=new Set();
     async function emitPostReply(r,stack=new Set()){
      const id=String(r.id);if(seen.has(id)||stack.has(id))return;stack.add(id);
      if(r.parentId&&all.has(String(r.parentId)))await emitPostReply(all.get(String(r.parentId)),stack);
      const who=personIdByPost(r,people);if(!who)return;
      const replyKey=postKey+':reply:'+id;
      const parent=(r.parentId&&all.has(String(r.parentId)))?'v26:'+postKey+':reply:'+r.parentId:rootId;
      await createPost(r,lang,replyKey,who,parent);seen.add(id);
     }
     for(const r of replies)await emitPostReply(r);
     for(const [qi,q] of (post.hwThread?.quotes||[]).entries()){
      await createPost(q,lang,postKey+':quote:'+(q.id||qi),personIdByPost(q,people),null,rootId);
     }
    }
   }
   // Include replies generated on individual profile posts in the same cloud thread.
   const allComments=snapshot.userComments?.[lang]||{};
   for(const [refKey,replies] of Object.entries(allComments)){
     const parts=/^post:([^:]+):(.+)$/.exec(refKey);
     if(!parts||!ids.has(parts[1])||!Array.isArray(replies))continue;
     const owner=parts[1],postId=parts[2],publishedId='v26:'+lang+':profile:'+owner+':'+postId;
     if(!docPostRows.some(row=>row.id===publishedId))continue;
     for(const [idx,reply] of replies.entries()){
       const authorId=personIdByPost(reply,people);if(!authorId)continue;
       await createPost(reply,lang,lang+':profile-comment:'+owner+':'+postId+':'+(reply.id||idx),authorId,publishedId);
     }
   }
  }
  status(`同步 ${chars.length} 位人物、${docPostRows.length} 条内容…`);
  // admin required by RLS even though the key is public
  for(let i=0;i<chars.length;i+=60){const{error}=await u().from('hw_characters').upsert(chars.slice(i,i+60),{onConflict:'id'});if(error)throw error;}
  // Persist the official directory only after all referenced character rows exist.
  const {error:castError}=await u().from('hw_site_settings').upsert({key:'public_cast_ids',value:publishedCastIds,updated_at:new Date().toISOString()},{onConflict:'key'});
  if(castError)throw Error('同步人物搜索名单失败：'+castError.message);
  // Character profile likes live in a separate public snapshot. They are not
  // authored timeline posts and must never be inserted into hw_posts.
  const nextLikesFingerprint=hwPublishFingerprint({likes:snapshot.profileLikes,cast:publishedCastIds});
  if(forceFull||previous.likes!==nextLikesFingerprint){
  const publicCharacterLikes={};
  for(const personId of publishedCastIds){
   const rows=snapshot.profileLikes?.zh?.[personId]||[];
   if(!Array.isArray(rows)||!rows.length)continue;
   publicCharacterLikes[personId]=[];
   for(const row of rows){
    if(!row||typeof row!=='object')continue;
    publicCharacterLikes[personId].push({
     id:String(row.id||'').slice(0,120),
     author_name:String(row.authorName||'校园网友').slice(0,100),
     author_handle:String(row.authorHandle||'anonymous').slice(0,100),
     author_avatar:await cloudImage(row.authorAvatar||''),
     author_verified:!!row.authorVerified,
     text:String(row.text||'').slice(0,12000),
     image_url:await cloudImage(row.media||''),
     time_label:String(row.time||'').slice(0,120),
     metrics:{replies:String(row.replies||'0'),reposts:String(row.reposts||'0'),likes:String(row.likes||'0'),views:String(row.views||'0'),bookmarks:String(row.bookmarks||'0')}
    });
   }
  }
  const {error:likesError}=await u().from('hw_site_settings').upsert({key:'public_character_profile_likes',value:publicCharacterLikes,updated_at:new Date().toISOString()},{onConflict:'key'});
  if(likesError)throw Error('同步人物主页喜欢内容失败：'+likesError.message);
  }
  // Postgres FK parent/quote rows must exist first. Sort by ancestor depth.
  const rank=new Map(docPostRows.map(p=>[p.id,p]));const depths=new Map();function depth(p,seen=new Set()){if(!p||seen.has(p.id))return 0;if(depths.has(p.id))return depths.get(p.id);seen.add(p.id);const dep=1+Math.max(depth(rank.get(p.parent_id),seen),depth(rank.get(p.quote_id),seen));depths.set(p.id,dep);seen.delete(p.id);return dep;}
  for(const post of docPostRows){const edited=v32Overrides[post.id];if(edited){post.body=edited.body;post.metrics=edited.metrics;if(edited.created_at)post.created_at=edited.created_at;}}
  docPostRows.sort((a,b)=>depth(a)-depth(b));
  // Re-publications preserve old stories and publication identity. Only new rows need time.
  const hwStoryNow=()=>{const d=new Date();d.setFullYear(d.getFullYear()-33);return d.getTime()};
  const hwStoryById=new Map();
  for(const row of docPostRows){
    const parent=hwStoryById.get(row.parent_id)||hwStoryById.get(row.quote_id);
    let at=Date.parse(row.story_at||'');
    if(!Number.isFinite(at)){
      if(parent){
        const seed=Math.random();
        const delay=seed<0.70?(2+Math.random()*50)*60000:
                    seed<0.95?(60+Math.random()*500)*60000:
                    (600+Math.random()*1800)*60000;
        at=Math.min(hwStoryNow(),parent+delay);
      }else at=hwStoryNow()-2*3600000;
    }
    if(parent&&at<=parent)at=parent+1000;
    if(at>hwStoryNow()){if(parent&&parent>=hwStoryNow())throw Error('父帖超出当前世界时间：'+row.id);at=hwStoryNow();}
    row.story_at=new Date(at).toISOString();hwStoryById.set(row.id,at);
  }
  // Batch writes within each ancestor depth; all parents are committed before their children.
  // This preserves FK ordering while avoiding one network request per comment.
  const groups=new Map();
  for(const p of docPostRows){const d=depth(p);if(!groups.has(d))groups.set(d,[]);groups.get(d).push(p)}
  for(const level of [...groups.keys()].sort((a,b)=>a-b)){
   const rows=groups.get(level);
   for(let i=0;i<rows.length;i+=50){
    const batch=rows.slice(i,i+50);
    const {error}=await u().from('hw_posts').upsert(batch,{onConflict:'id'});
    if(error)throw Error('同步 '+batch[0].id+' 等 '+batch.length+' 条内容失败：'+error.message);
   }
  }
  const migrationFirstPublish=localStorage.getItem('hw-gh-migration-first-publish')==='1';
  // Remove only stale V26-mirrored rows; leave real visitors' posts and reactions untouched.
  const stale=migrationFirstPublish?[]:(existingResp.data||[]).filter(p=>!desiredPostIds.has(p.id)).map(p=>p.id);
  // Delete deepest children first to avoid dangling refs from existing content.
  for(const id of stale){const{error}=await u().from('hw_posts').delete().eq('id',id);if(error)console.warn('Failed to prune stale V26 content',id,error.message);else delete v32Overrides[id];}try{localStorage.setItem('hw-v32-cloud-overrides',JSON.stringify(v32Overrides))}catch{}
  // Reconcile deleted cast members with public cloud. Never auto-delete players.
  const {data:cloudCast,error:castErr}=await u().from('hw_characters').select('id,name').limit(2000);
  if(castErr)throw castErr;
  const removed=migrationFirstPublish?[]:(cloudCast||[]).filter(x=>!ids.has(x.id));
  if(removed.length){
   const message='人物库中有 '+removed.length+' 位已被删除的人物（'+removed.slice(0,8).map(p=>p.name).join('、')+'）。\n同步删除会同时移除其云端帖子、评论以及与玩家的私信会话（不可恢复）。\n确定删除吗？';
   if(confirm(message)){
    for(const p of removed){const {error}=await u().from('hw_characters').delete().eq('id',p.id);if(error)throw Error('删除人物 '+p.name+' 失败：'+error.message);}
    status('✅ 已同步人物库；删除 '+removed.length+' 位人物及关联内容。');
   }else status('人物发布成功，但已删除人物仍保留在游客端。要同步删除，请下次发布时确认。');
  }else status(`✅ 增量发布完成：更新 ${chars.length} 位人物、${docPostRows.length} 条帖子或评论；跳过未修改的 ${reusedCharacters} 位人物和 ${reusedPosts} 条内容。`);
  if(migrationFirstPublish)localStorage.removeItem('hw-gh-migration-first-publish');
  // Advance the baseline only when all required writes succeeded.
  hwSavePublishCache(HW_PUBLISH_HASH_KEY,{posts:nextPostHashes,characters:nextCharacterHashes,likes:nextLikesFingerprint});
  // Do not keep the publish button busy while refreshing the admin timeline.
  v32Reload().catch(console.warn);
 }catch(e){console.error(e);const message=H.errMsg(e);if(message.includes('hw_characters_badge_type_check'))status('发布失败：人物标志类型与数据库格式不一致。请更新 V27.9.1 后重试；无需修改 SQL 或管理员权限。');else status('发布失败：'+message+'\n只有遇到权限或表不存在错误时，才需要检查 schema.sql 与 hw_admins。');}
 finally{busyState(false)}
}
async function listOptions(){if(!admin)return;const[profiles,characters]=await Promise.all([u().from('hw_profiles').select('id,display_name,handle').order('created_at',{ascending:false}).limit(200),u().from('hw_characters').select('id,name,handle').order('name').limit(200)]);
 if(profiles.error||characters.error){status('读取云端用户失败：'+H.errMsg(profiles.error||characters.error));return;}
 $('hwCloudVisitor').innerHTML=(profiles.data||[]).map(p=>`<option value="${S(p.id)}">${S(p.display_name)} @${S(p.handle)}</option>`).join('')||'<option value="">尚无注册用户</option>';
 $('hwCloudCharacter').innerHTML=(characters.data||[]).map(p=>`<option value="${S(p.id)}">${S(p.name)} @${S(p.handle)}</option>`).join('')||'<option value="">请先发布人物库</option>';
}
async function refreshInbox(){
 if(!admin)return;
 const {data:convos,error}=await u().from('hw_conversations').select('id,user_id,character_id,created_at').order('created_at',{ascending:false}).limit(500);
 if(error){status('玩家来信列表读取失败：'+H.errMsg(error));return;}
 const select=$('hwCloudInbox'),remember=select.value;
 const [pr,ch,msg]=await Promise.all([
  u().from('hw_profiles').select('id,display_name,handle').limit(1000),
  u().from('hw_characters').select('id,name,handle').limit(1000),
  u().from('hw_messages').select('conversation_id,created_at,sender_kind,body,recalled').order('created_at',{ascending:false}).limit(2000)
 ]);
 if(pr.error||ch.error||msg.error){status('玩家来信加载失败：'+H.errMsg(pr.error||ch.error||msg.error));return;}
 const users=new Map((pr.data||[]).map(r=>[r.id,r]));const people=new Map((ch.data||[]).map(r=>[r.id,r]));
 const latest=new Map();for(const m of msg.data||[])if(!latest.has(m.conversation_id))latest.set(m.conversation_id,m);
 const sorted=(convos||[]).filter(c=>latest.has(c.id)).sort((a,b)=>new Date(latest.get(b.id)?.created_at||b.created_at)-new Date(latest.get(a.id)?.created_at||a.created_at));
 select.innerHTML='<option value="">选择玩家来信（'+sorted.length+' 个对话）</option>'+sorted.map(c=>{
  const us=users.get(c.user_id),char=people.get(c.character_id),last=latest.get(c.id);
  return `<option value="${S(c.id)}">${last.sender_kind==='user'?'📩 新消息 · ':'↩ 已回复 · '}${S(us?.display_name||us?.handle||'玩家')} → ${S(char?.name||'人物')} · ${S(String(last.body||'[图片]').slice(0,28))}</option>`;
 }).join('');
 if(sorted.some(c=>c.id===remember))select.value=remember;
 if(!activeConversation&&sorted.some(c=>latest.get(c.id)?.sender_kind==='user')){
   const incoming=sorted.find(c=>latest.get(c.id)?.sender_kind==='user');select.value=incoming.id;await selectInboxConversation(incoming.id,sorted);
 }
}
async function selectInboxConversation(id,known){
 if(!admin||!id)return;
 let convo=(known||[]).find(c=>c.id===id);
 if(!convo){const r=await u().from('hw_conversations').select('*').eq('id',id).maybeSingle();if(r.error)throw r.error;convo=r.data;}
 if(!convo)return;
 activeConversation=convo;$('hwCloudVisitor').value=convo.user_id;$('hwCloudCharacter').value=convo.character_id;
 await refreshMsgs();
}
async function openConversation(){if(!admin||!$('hwCloudVisitor').value||!$('hwCloudCharacter').value)return;
 const query={user_id:$('hwCloudVisitor').value,character_id:$('hwCloudCharacter').value};
 const{data,error}=await u().from('hw_conversations').upsert(query,{onConflict:'user_id,character_id'}).select('*').single();if(error)throw error;activeConversation=data;renderConversationMeta();await refreshMsgs();}
async function refreshMsgs(){if(!activeConversation)return;const{data,error}=await u().from('hw_messages').select('*').eq('conversation_id',activeConversation.id).order('created_at',{ascending:true}).limit(80);if(error)throw error;
 const chunks=[];for(const msg of (data||[])){
  const text=msg.recalled?'[已撤回]':msg.body||'[图片]';chunks.push((msg.sender_kind==='user'?'用户':'角色')+'：'+text);
 }$('hwCloudMessageList').textContent=chunks.join('\n')||'暂无消息，可以发送第一条。';$('hwCloudMessageList').scrollTop=$('hwCloudMessageList').scrollHeight;}
async function sendDM(){try{if(!activeConversation)await openConversation();if(!activeConversation)throw Error('请先选择用户与角色');const body=$('hwCloudMessageBody').value.trim();const img=$('hwCloudDMImage').files?.[0];if(!body&&!img)throw Error('消息不能为空');busyState(true);
  const image_url=img?await H.uploadPrivate(img,activeConversation.id):null;
  const{error}=await u().from('hw_messages').insert({conversation_id:activeConversation.id,sender_kind:'character',body,image_url});if(error)throw error;
  $('hwCloudMessageBody').value='';$('hwCloudDMImage').value='';await refreshMsgs();await refreshInbox();status('✅ 角色私信已同步到该用户的收件箱。');
 }catch(e){status('发送失败：'+H.errMsg(e))}finally{busyState(false)}}
$('hwCloudLoginBtn').onclick=async()=>{
 const b=$('hwCloudLoginBtn');b.disabled=true;
 try{await H.sendLogin($('hwCloudEmail').value);status('📩 登录链接已发送（如果 Supabase 邮件额度允许）。请到 Gmail 点击最新邮件里的链接。链接只会登录打开它的设备，不要反复点击。');}
 catch(e){const m=H.errMsg(e);status(/email rate limit|over_email_send_rate_limit|429/i.test(m)?'Supabase 默认邮件发送额度已达到上限。请不要连续点击，待邮件服务额度恢复后再试。':'请求登录邮件失败：'+m);}
 finally{b.disabled=false}
};
$('hwCloudPublish').onclick=publish;
$('hwCloudAuto').onchange=e=>{autoEnabled=e.target.checked;if(autoEnabled){status('已开启自动同步。每次本地修改约 5 秒后自动发布。');}else{clearTimeout(autoTimer);status('自动同步已关闭。')}};




$('hwCloudSignOut').onclick=async()=>{await H.signOut();admin=false;renderAuth()};
$('hwCloudOtherSignOut').onclick=async()=>{try{await H.signOut();admin=false;await renderAuth()}catch(e){status('退出失败：'+H.errMsg(e))}};
window.addEventListener('hw:legacy-changed',()=>{if(!autoEnabled||!admin||busy)return;clearTimeout(autoTimer);autoTimer=setTimeout(publish,5000)});
async function renderAuth(){await H.ready;
 if(!H.client){status('Supabase 组件暂未加载，请检查网络后刷新。编辑器本地功能仍可用。');$('hwCloudAuthTools').hidden=true;return;}
 if(!H.user){admin=false;$('hwCloudLogin').hidden=false;$('hwCloudOtherAccount').hidden=true;$('hwCloudAuthTools').hidden=true;status(H.callbackError||'请填写开发者邮箱，点击发送登录链接。');return;}
 try{admin=await H.isAdmin();$('hwCloudLogin').hidden=true;$('hwCloudOtherAccount').hidden=admin;$('hwCloudAuthTools').hidden=!admin;
  if(admin){status('✅ 管理员已登录。每条人物主贴均可独立编辑、随机互动数据和添加评论。');await refreshIntegratedDM();await v32Reload().catch(e=>status('帖子列表读取失败：'+H.errMsg(e)));const {data:trendRow}=await u().from('hw_site_settings').select('value').eq('key','public_trends').maybeSingle();if(trendRow?.value&&Array.isArray(trendRow.value)){window.hwApplyPublicTrends?.(trendRow.value);}}
  else status('当前是玩家账号（'+H.user.email+'），没有开发者权限。请点击“退出玩家账号”，再输入开发者邮箱发送登录链接。');
 }catch(e){status('权限校验失败：'+H.errMsg(e)+'。请先执行 supabase_schema.sql。');$('hwCloudAuthTools').hidden=true;}
}
H.onAuth(()=>renderAuth());
if(H.client)H.client.channel('hw-admin-conv-monitor').on('postgres_changes',{event:'*',schema:'public',table:'hw_messages'},()=>refreshIntegratedDM().catch(console.warn)).on('postgres_changes',{event:'*',schema:'public',table:'hw_conversations'},()=>refreshIntegratedDM().catch(console.warn)).subscribe();
// Keep the unified timeline in step with new player posts and comments.
if(H.client)H.client.channel('hw-v32-post-monitor').on('postgres_changes',{event:'*',schema:'public',table:'hw_posts'},()=>{if(admin)v32Reload().catch(console.warn)}).on('postgres_changes',{event:'*',schema:'public',table:'hw_characters'},()=>{if(admin)v32Reload().catch(console.warn)}).subscribe();
window.addEventListener('focus',()=>{if(admin){refreshIntegratedDM().catch(console.warn);v32Reload().catch(console.warn)}});
setInterval(()=>{if(admin)refreshIntegratedDM().catch(console.warn)},20000);
})();




