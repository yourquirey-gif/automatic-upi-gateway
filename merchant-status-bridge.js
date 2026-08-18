(()=>{
  const bind=()=>{
    const button=[...document.querySelectorAll('#nav button')].find(b=>b.dataset.page==='Connect Merchant');
    if(!button||button.dataset.omniStatusBridge)return;
    button.dataset.omniStatusBridge='1';
    button.addEventListener('click',event=>{
      if(typeof window.omniMerchants!=='function')return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.omniMerchants();
    },{capture:true});
  };
  bind();
  new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});
})();
