(function(){
  function addBlogNav(){
    const nav=document.querySelector('.nav');
    if(!nav||nav.querySelector('[data-blog-nav]')) return;
    const btn=document.createElement('button');
    btn.className='nav-item';
    btn.setAttribute('data-blog-nav','1');
    btn.innerHTML='<span style="font-size:17px">✎</span><span>Blog Manager</span>';
    btn.onclick=function(){window.location.href='/admin/blog.html';};
    nav.appendChild(btn);
  }
  const observer=new MutationObserver(addBlogNav);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  addBlogNav();
})();
