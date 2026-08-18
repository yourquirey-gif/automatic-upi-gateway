(function(){
  function addBlogNav(){
    const nav=document.getElementById('nav');
    if(!nav||nav.querySelector('[data-blog-nav]')) return;
    const label=document.createElement('div');
    label.className='section-label';
    label.textContent='RESOURCES';
    const btn=document.createElement('button');
    btn.setAttribute('data-page','Blog');
    btn.setAttribute('data-blog-nav','1');
    btn.innerHTML='▤ <span>Blog</span>';
    btn.onclick=function(){location.href='./blog.html';};
    nav.appendChild(label);
    nav.appendChild(btn);
  }
  const observer=new MutationObserver(addBlogNav);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  addBlogNav();
})();
