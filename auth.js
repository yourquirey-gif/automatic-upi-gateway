const API_BASE_URL=(window.API_BASE_URL||'https://api.omniupi.in').replace(/\/$/,'');
const AUTH_BASE_URL=window.AUTH_BASE_URL||API_BASE_URL;
function apiUrl(path){return `${API_BASE_URL}${path.startsWith('/')?path:`/${path}`}`}
function authUrl(mode){return `${AUTH_BASE_URL}/auth/google?mode=${encodeURIComponent(mode)}&return_to=${encodeURIComponent(location.href)}`}
function renderAuth(){
  document.querySelector('.shell')?.setAttribute('hidden','hidden');
  let el=document.getElementById('authScreen');
  if(el)return;
  document.body.insertAdjacentHTML('afterbegin',`<div id="authScreen"><div class="auth-card"><div class="auth-brand"><div class="auth-logo">U</div><div><b>UPI Gateway</b><small>Secure payment infrastructure</small></div></div><div class="auth-tabs"><button class="auth-tab active" id="loginTab" onclick="setAuthMode('login')">Login</button><button class="auth-tab" id="signupTab" onclick="setAuthMode('signup')">Sign up</button></div><div id="authContent"></div></div></div>`);
  setAuthMode('login');
}
function setAuthMode(mode){
  const login=mode==='login';
  document.getElementById('loginTab')?.classList.toggle('active',login);document.getElementById('signupTab')?.classList.toggle('active',!login);
  document.getElementById('authContent').innerHTML=`<h1 class="auth-title">${login?'Welcome back':'Create your account'}</h1><p class="auth-copy">${login?'Sign in to manage merchants, payments and API integrations.':'Create your gateway account and manage your payment infrastructure from one dashboard.'}</p><div class="auth-error" id="authError"></div><button class="google-auth" onclick="continueWithGoogle('${mode}')"><span class="google-g">G</span>${login?'Continue with Google':'Sign up with Google'}</button><div class="auth-divider">OR</div><form class="auth-form" onsubmit="return submitEmailAuth(event,'${mode}')">${login?'':'<label>Full name<input id="authName" type="text" autocomplete="name" placeholder="Your full name" minlength="2" required></label>'}<label>Email address<input id="authEmail" type="email" autocomplete="email" placeholder="you@example.com" required></label><label>Password<input id="authPassword" type="password" autocomplete="${login?'current-password':'new-password'}" placeholder="••••••••" minlength="8" required></label>${login?'':'<label>Confirm password<input id="authConfirm" type="password" autocomplete="new-password" placeholder="••••••••" minlength="8" required></label>'}<button class="primary auth-submit" id="authSubmit" type="submit">${login?'Login':'Create account'}</button></form><div class="auth-note">Your password is sent only to the secure API over HTTPS and is never stored in plain text.</div><p class="auth-foot">By continuing, you agree to use authorized payment accounts and integrations only.</p>`;
}
function showAuthError(message){const e=document.getElementById('authError');if(e){e.style.display='block';e.textContent=message}}
async function submitEmailAuth(event,mode){
  event.preventDefault();
  const email=document.getElementById('authEmail')?.value.trim();
  const password=document.getElementById('authPassword')?.value||'';
  const name=document.getElementById('authName')?.value.trim()||'';
  const confirm=document.getElementById('authConfirm')?.value||'';
  if(!email||password.length<8)return false;
  if(mode==='signup'&&password!==confirm){showAuthError('Passwords do not match.');return false}
  const button=document.getElementById('authSubmit');
  if(button){button.disabled=true;button.textContent=mode==='login'?'Signing in…':'Creating account…'}
  try{
    const response=await fetch(apiUrl(`/api/v1/auth/${mode==='login'?'login':'register'}`),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mode==='login'?{email,password}:{name,email,password})});
    let data={};try{data=await response.json()}catch{}
    if(!response.ok||!data.status)throw new Error(data.message||`Authentication failed (${response.status})`);
    localStorage.setItem('omniupi_token',data.token||'');
    localStorage.setItem('omniupi_user',JSON.stringify(data.user||{}));
    if(data.trial)localStorage.setItem('omniupi_trial',JSON.stringify(data.trial));
    continueToPanel();
  }catch(error){showAuthError(error.message||'Unable to connect to the backend. Please try again.');}
  finally{if(button){button.disabled=false;button.textContent=mode==='login'?'Login':'Create account'}}
  return false;
}
function continueWithGoogle(mode){
  if(AUTH_BASE_URL){location.href=authUrl(mode);return}
  showAuthError('Google OAuth backend is not configured yet.');
}
function continueToPanel(){document.getElementById('authScreen')?.remove();document.querySelector('.shell')?.removeAttribute('hidden');if(typeof show==='function')show('Dashboard');else if(location.hash!=='#dashboard')location.hash='dashboard'}
function replaceMerchantModal(){
  const modal=document.getElementById('merchantModal');if(!modal)return;
  const card=modal.querySelector('.modal-card');if(!card)return;
  card.innerHTML=`<button class="modal-close" aria-label="Close" onclick="closeMerchant()">×</button><div class="eyebrow">CONNECT PAYMENT ACCOUNT</div><h2 id="merchantTitle">Add Merchant</h2><p class="modal-sub">First enter the UPI ID and mobile number registered with the payment account. After that, continue only with Google.</p><label>UPI ID<input id="upiId" autocomplete="off" placeholder="merchant@upi"></label><label>Registered Mobile Number<input id="mobile" inputmode="numeric" maxlength="10" autocomplete="tel" placeholder="10-digit mobile number"></label><div class="google-box"><b>Use the Gmail linked to your payment account</b><small>Sign in with the same Google/Gmail account that is linked to this payment account. This authorization is used by the backend to read authorized payment notifications. We never ask for your Gmail password or App Password.</small><button class="secondary" onclick="merchantGoogleConnect()"><span class="google-g">G</span>&nbsp; Continue with Google</button></div><div class="merchant-link-note">Only the UPI ID and registered mobile number are collected before Google authorization. KYC can be completed later according to the selected plan/provider requirements.</div>`;
}
function merchantGoogleConnect(){
  const upi=document.getElementById('upiId')?.value.trim();const mobile=(document.getElementById('mobile')?.value||'').replace(/\D/g,'');
  if(!upi||mobile.length!==10){alert('Please enter a valid UPI ID and 10-digit mobile number first.');return}
  sessionStorage.setItem('pendingMerchant',JSON.stringify({upi,mobile}));
  if(AUTH_BASE_URL){location.href=`${AUTH_BASE_URL}/auth/google/merchant?upi=${encodeURIComponent(upi)}&mobile=${encodeURIComponent(mobile)}&return_to=${encodeURIComponent(location.href)}`;return}
  alert('Google OAuth backend is not connected yet.');
}
renderAuth();
setTimeout(replaceMerchantModal,0);