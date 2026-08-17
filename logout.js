(()=>{
  window.logoutGateway=()=>{
    localStorage.removeItem('autogateway_token');
    localStorage.removeItem('autogateway_user');
    location.href='./index.html?logged_out=1';
  };
})();
