(()=>{
  const CANONICAL='https://api.omniupi.in';
  const LEGACY='https://api.omniupi.in';
  const originalFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>{
    try{
      const raw=typeof input==='string'?input:input?.url;
      if(raw && raw.startsWith(LEGACY)) input=raw.replace(LEGACY,CANONICAL);
    }catch{}
    return originalFetch(input,init);
  };
  window.OMNIUPI={API:CANONICAL,WEB:'https://omniupi.in',BRAND:'OmniUPI'};
})();
