
/* V27.6: selected character -> independent main post composer. */
(function(){
  const $=id=>document.getElementById(id);
  const source=$('postPersonSelect'), profile=$('pvPersonSelect'), target=$('v276PostAuthorSelect');
  if(!target)return;
  function syncOptions(){
    const from=(source&&source.options&&source.options.length>1)?source:profile;
    if(!from)return;
    const old=target.value;
    target.innerHTML=from.innerHTML;
    if([...target.options].some(o=>o.value===old))target.value=old;
    else if(profile?.value && [...target.options].some(o=>o.value===profile.value))target.value=profile.value;
    else if(from.value)target.value=from.value;
  }
  syncOptions();
  if(source&&window.MutationObserver)new MutationObserver(syncOptions).observe(source,{childList:true});
  if(profile&&window.MutationObserver)new MutationObserver(syncOptions).observe(profile,{childList:true});
  target.addEventListener('change',()=>{
    if(source){source.value=target.value;}
    if(profile){profile.value=target.value;profile.dispatchEvent(new Event('change',{bubbles:true}));}
  });
  $('v276StartCharacterPost')?.addEventListener('click',()=>{
    if(!target.value){alert('请先选择人物账号。');return;}
    if(profile){profile.value=target.value;profile.dispatchEvent(new Event('change',{bubbles:true}));}
    $('pvProfileMode')?.click();
    setTimeout(()=>{const box=$('pvComposeInput');box?.scrollIntoView({block:'center',behavior:'smooth'});box?.focus({preventScroll:true});},140);
  });
})();
