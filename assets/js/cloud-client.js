
/* 《今日霍格沃茨不宜恋爱》· V27.9 分离的 Supabase 客户端
 * Publishable Key 是公开的前端密钥；所有写入权限必须由 Supabase RLS 强制执行。
 */
(function(){
'use strict';
const PROJECT_URL='https://jxviljkxbcucytmxqviu.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_t8sSeZpAwa3cyW2bj_vKqA_-qVP3jzP';
const client=window.supabase&&typeof window.supabase.createClient==='function'
 ?window.supabase.createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'hogwarts-v279-developer-auth'}})
 :null;
const CANONICAL_SITE='https://ceciliageng64-wq.github.io/hogwarts-social';
const errMsg=e=>e?.message||String(e||'未知错误');
let user=null,callbackError='';const authListeners=new Set();
const notify=()=>{for(const cb of authListeners){try{cb(user)}catch(e){console.warn(e)}}};
const redirectParams=new URLSearchParams(location.hash.slice(1));
const queryParams=new URLSearchParams(location.search);
const errCode=redirectParams.get('error_code')||queryParams.get('error_code');
if(errCode)callbackError=(errCode==='otp_expired'||errCode==='access_denied')?'登录邮件链接已过期或已经使用。请在额度恢复后申请新的邮件。':'邮箱验证失败：'+errCode;
// Independent developer auth storage. Never read the former shared player session.
// Native Supabase client: it processes redirect tokens and persists the session itself.
// Do NOT manually exchange codes or call setSession a second time.
const ready=(async()=>{
 if(!client)return null;
 const {data,error}=await client.auth.getSession();
 if(error)throw error;
 user=data?.session?.user||null;
 notify();
 return user;
})().catch(e=>{callbackError='邮箱会话初始化失败：'+errMsg(e);user=null;notify();return null});
if(client)client.auth.onAuthStateChange((event,session)=>{
 user=session?.user||null;
 if(event==='SIGNED_IN')callbackError='';
 // Auth callbacks can hold a lock; defer all further data queries until after callback returns.
 setTimeout(notify,0);
});
function onAuth(callback){authListeners.add(callback);ready.then(()=>callback(user));return()=>authListeners.delete(callback)}
async function sendLogin(email){
 if(!client)throw Error('Supabase 网络组件未加载，请刷新网页。');
 if(location.origin+location.pathname.replace(/\/[^/]*$/, '')!==CANONICAL_SITE)throw Error('请在正式网站 '+CANONICAL_SITE+'/index.html 使用邮箱登录，不要在 Netlify 预览框登录。');
 if(String(email||'').trim().toLowerCase()!=='ceciliageng64@gmail.com')throw Error('开发者入口仅接受指定管理员邮箱。');
 const {error}=await client.auth.signInWithOtp({email:'ceciliageng64@gmail.com',options:{emailRedirectTo:CANONICAL_SITE+'/auth-callback.html',shouldCreateUser:false}});
 if(error)throw error;
 return true;
}
// V27.5: game-only accounts. No real email address or verification mail is used.
// Player identities are verified by Supabase Auth with a synthetic email;
// RLS continues to separate each player's posts, likes, follows and DMs.
async function enterGame(alias,password){
 // V27.9: administrator page never logs in with a player account.
 throw Error('玩家登录请打开 user.html；开发者后台只接受管理员邮箱。');
 if(!client)throw Error('云端连接组件没有加载，请刷新网页。');
 if(location.origin+location.pathname.replace(/\/[^/]*$/, '')!==CANONICAL_SITE)throw Error('请打开正式网站 '+CANONICAL_SITE+'/user.html 登录，Netlify 的预览页不共用登录状态。');
 alias=String(alias||'').trim().normalize('NFKC');
 if(alias.length<3||alias.length>80)throw Error('游戏账号请填写 3–80 个字符（可以是虚构邮箱，也可以是昵称）。');
 if(!password||password.length<8||password.length>128)throw Error('游戏密码请填写 8–128 位。');
 const endpoint=PROJECT_URL+'/functions/v1/hogwarts-player-register';
 const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify({alias,password}),cache:'no-store',mode:'cors'});
 const payload=await res.json().catch(()=>({}));
 if(!res.ok||!payload.gameEmail)throw Error(payload.error||'玩家账号服务暂不可用，请稍后重试。');
 const auth=await client.auth.signInWithPassword({email:payload.gameEmail,password});
 if(auth.error)throw Error('登录失败：游戏密码不正确，或游戏账号已被其他人使用。请换一个名字重试。');
 user=auth.data?.user||null;notify();
 return {created:!!payload.created,user};
}
async function signOut(){if(client){const{error}=await client.auth.signOut({scope:'local'});if(error)throw error;}user=null;notify();}
async function isAdmin(){if(!client||!user)return false;const{data,error}=await client.from('hw_admins').select('user_id').eq('user_id',user.id).maybeSingle();if(error)throw error;return !!data;}
function imageBlobFromDataUrl(url){const parts=String(url).split(',');if(parts.length<2)throw Error('图片格式无效');const mime=/data:([^;]+)/.exec(parts[0])?.[1]||'image/png';const bytes=Uint8Array.from(atob(parts[1]),c=>c.charCodeAt(0));return new Blob([bytes],{type:mime});}
function extForMime(mime){return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'})[mime]||'png';}
async function uploadPublic(file,role='user'){
 if(!client||!user)throw Error('需要登录后上传图片。');
 const type=file.type||'image/png';if(!['image/jpeg','image/png','image/webp','image/gif'].includes(type))throw Error('请上传 PNG / JPG / WEBP / GIF 图片');
 if(file.size>10*1024*1024)throw Error('图片不可超过 10 MB');
 const folder=role==='admin'?'admin/'+user.id:'user/'+user.id;
 const filename=folder+'/'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random())+'.'+extForMime(type);
 const{error}=await client.storage.from('hw-public').upload(filename,file,{cacheControl:'3600',upsert:false,contentType:type});if(error)throw error;
 return client.storage.from('hw-public').getPublicUrl(filename).data.publicUrl;
}
async function uploadPrivate(file,conversationId){
 if(!client||!user)throw Error('请先登录');const type=file.type||'image/png';
 if(!['image/jpeg','image/png','image/webp','image/gif'].includes(type))throw Error('仅支持图片');
 if(file.size>10*1024*1024)throw Error('图片不可超过 10 MB');
 const path=conversationId+'/'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random())+'.'+extForMime(type);
 const{error}=await client.storage.from('hw-private').upload(path,file,{cacheControl:'3600',contentType:type});if(error)throw error;return 'private:'+path;
}
async function signedPrivate(src){if(!src?.startsWith('private:'))return src||'';if(!client||!user)return '';
 const{data,error}=await client.storage.from('hw-private').createSignedUrl(src.slice(8),3600);if(error)throw error;return data.signedUrl;}
async function ensureUserProfile(){if(!user||!client)return null;
 const{data:old,error:e}=await client.from('hw_profiles').select('*').eq('id',user.id).maybeSingle();if(e)throw e;if(old)return old;
 let base=(user.email||'hogwarts').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,15);if(base.length<3)base='visitor';
 for(let i=0;i<5;i++){const candidate=base+'_'+user.id.replace(/-/g,'').slice(0,6)+(i||'');const row={id:user.id,handle:candidate.slice(0,32),display_name:'霍格沃茨访客',joined_label:'1991年9月'};
  const{data,error}=await client.from('hw_profiles').insert(row).select('*').single();if(!error)return data;
  if(error.code==='23505')continue;throw error;}
 throw Error('无法建立个人资料，请检查数据库配置。');
}
function renderBadge(type='none'){
 const fill={blue:'#1d9bf0',gold:'#f2b63d',grey:'#81919b',affiliate:'#587fa9'}[type];if(!fill)return '';
 return `<svg class="hw-badge" width="17" height="17" viewBox="0 0 24 24" role="img" aria-label="认证标记"><path d="M12 1.5 14.4 3l2.8-.1 1.2 2.6 2.5 1.4-.2 2.8L22.5 12l-1.8 2.3.2 2.8-2.5 1.4-1.2 2.6-2.8-.1-2.4 1.5-2.4-1.5-2.8.1-1.2-2.6-2.5-1.4.2-2.8L1.5 12l1.8-2.3-.2-2.8 2.5-1.4 1.2-2.6L9.6 3Z" fill="${fill}"/><path d="M7.8 12.2 10.7 15l5.6-6" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
window.HWCloud={PROJECT_URL,PUBLISHABLE_KEY,client,ready,onAuth,get user(){return user;},get callbackError(){return callbackError;},CANONICAL_SITE,sendLogin,enterGame,signOut,isAdmin,uploadPublic,uploadPrivate,signedPrivate,ensureUserProfile,imageBlobFromDataUrl,renderBadge,escapeHtml,errMsg};
})();

