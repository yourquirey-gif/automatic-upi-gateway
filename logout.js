(()=>{
  window.logoutGateway=()=>{
    localStorage.removeItem('omniupi_token');
    localStorage.removeItem('omniupi_user');
    location.href='./index.html?logged_out=1';
  };

  function addBlogNav(){
    const nav=document.getElementById('nav');
    if(!nav||nav.querySelector('[data-blog-nav]')) return;
    const label=document.createElement('div');
    label.className='section-label';
    label.textContent='RESOURCES';
    const btn=document.createElement('button');
    btn.setAttribute('data-blog-nav','1');
    btn.setAttribute('data-page','Blog');
    btn.innerHTML='▤ <span>Blog</span>';
    btn.onclick=()=>{ location.href='./blog.html'; };
    nav.appendChild(label);
    nav.appendChild(btn);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addBlogNav);
  else addBlogNav();
  new MutationObserver(addBlogNav).observe(document.documentElement,{childList:true,subtree:true});
})();
