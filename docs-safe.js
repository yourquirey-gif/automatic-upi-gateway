(function(){
  const originalDocsPage=window.docsPage;
  if(typeof originalDocsPage!=='function') return;
  window.docsPage=async function(){
    await originalDocsPage();
    const token=localStorage.getItem('omniupi_token');
    if(!token) return;
    document.querySelectorAll('.doc-code code').forEach(el=>{el.textContent=el.textContent.split(token).join('YOUR_API_TOKEN')});
    document.querySelectorAll('.doc-copy').forEach(btn=>{const value=btn.getAttribute('onclick')||'';if(value.includes(token))btn.setAttribute('onclick',value.split(token).join('YOUR_API_TOKEN'))});
  };
})();
