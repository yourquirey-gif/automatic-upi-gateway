(()=>{
  window.logoutGateway=()=>{
    localStorage.removeItem('omniupi_token');
    localStorage.removeItem('omniupi_user');
    location.href='./index.html?logged_out=1';
  };
})();
