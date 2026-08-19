import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { google } from 'googleapis';
import User from '../models/User.js';
import Merchant from '../models/Merchant.js';
import GatewaySettings from '../models/GatewaySettings.js';
import { nextUserId } from '../utils/userId.js';
import { createGoogleClient, verifyMerchantGmail } from '../services/gmailPaymentVerifier.js';

const router = Router();
function signToken(user){const secret=process.env.JWT_SECRET;if(!secret)throw new Error('JWT_SECRET is not configured');return jwt.sign({sub:user._id.toString(),role:user.role},secret,{expiresIn:'7d'});}
function trialDates(){const started=new Date();return {started,ends:new Date(started.getTime()+2*86400000)};}
function createApiCredentials(){return {apiToken:`ag_live_${crypto.randomBytes(32).toString('hex')}`,instanceSecret:`ag_sec_${crypto.randomBytes(32).toString('hex')}`};}
async function googleEnabled(){const settings=await GatewaySettings.findOne({key:'global'}).lean();return settings?.googleOAuthEnabled===true;}
function publicWeb(){return String(process.env.PUBLIC_WEB_BASE_URL||'https://omniupi.in').replace(/\/$/,'');}
function normalizeUpi(value){return String(value||'').trim().toLowerCase();}
async function adminSettlementUpi(){const settings=await GatewaySettings.findOne({key:'global'}).lean();return normalizeUpi(settings?.settlementUpiId);}

// Dedicated administrator login endpoint. This cannot authenticate a normal merchant/user.
router.post('/admin-login',async(req,res,next)=>{try{
  const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');
  if(!email||!password)return res.status(400).json({status:false,message:'Administrator email and password are required'});
  const configuredAdmin=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
  if(configuredAdmin&&email!==configuredAdmin)return res.status(403).json({status:false,message:'Administrator access denied'});
  const user=await User.findOne({email,role:'admin'}).select('+passwordHash');
  if(!user||user.status!=='active'||!(await bcrypt.compare(password,user.passwordHash||'')))return res.status(401).json({status:false,message:'Invalid administrator credentials'});
  return res.json({status:true,token:signToken(user),subscription:{required:false,active:true,permanent:true},user:{id:user._id,userId:user.userId||null,name:user.name,email:user.email,role:'admin'}});
}catch(e){next(e)}});

router.get('/google/config',async(_req,res,next)=>{try{res.json({status:true,enabled:await googleEnabled()});}catch(e){next(e)}});
router.get('/google',async(req,res,next)=>{try{if(!await googleEnabled())return res.status(404).send('Google sign-up is currently disabled.');const client=await createGoogleClient('auth');const mode=['login','signup'].includes(String(req.query.mode))?String(req.query.mode):'login';const state=jwt.sign({purpose:'google-auth',mode},process.env.JWT_SECRET,{expiresIn:'10m'});res.redirect(client.generateAuthUrl({access_type:'offline',prompt:'select_account',state,scope:['openid','email','profile']}));}catch(e){next(e)}});

// Merchant onboarding supports normal users and administrators, but the Admin
// Settlement UPI is private and can never be claimed by a normal account.
router.get('/google/merchant',async(req,res,next)=>{try{
  if(!await googleEnabled())return res.status(404).send('Google OAuth is currently disabled.');
  const upi=normalizeUpi(req.query.upi),mobile=String(req.query.mobile||'').replace(/\D/g,'');
  if(!upi||!mobile||mobile.length!==10)return res.status(400).send('Valid UPI ID and 10-digit mobile number are required.');
  const adminUpi=await adminSettlementUpi();
  if(adminUpi&&upi===adminUpi)return res.status(403).send('This UPI ID is reserved for the administrator. Please enter your own merchant UPI ID.');
  const client=await createGoogleClient('auth');
  const state=jwt.sign({purpose:'merchant-google-onboarding',upi,mobile},process.env.JWT_SECRET,{expiresIn:'10m'});
  res.redirect(client.generateAuthUrl({access_type:'offline',prompt:'consent',state,scope:['openid','email','profile','https://www.googleapis.com/auth/gmail.readonly']}));
}catch(e){next(e)}});

router.get('/google/callback',async(req,res,next)=>{try{
  const payload=jwt.verify(String(req.query.state||''),process.env.JWT_SECRET);
  if(!['google-auth','merchant-google-onboarding'].includes(payload.purpose))return res.status(400).send('Invalid OAuth state');
  const client=await createGoogleClient('auth');
  const {tokens}=await client.getToken(String(req.query.code||''));
  if(!tokens.access_token)return res.status(400).send('Google authorization did not return an access token.');
  client.setCredentials(tokens);
  const oauth2=google.oauth2({version:'v2',auth:client});
  const profile=await oauth2.userinfo.get();
  const email=String(profile.data.email||'').trim().toLowerCase(),googleId=String(profile.data.id||'').trim(),name=String(profile.data.name||email.split('@')[0]||'Merchant').trim();
  if(!email||!googleId||profile.data.verified_email===false)return res.status(400).send('Google account did not provide a verified email.');

  if(payload.purpose==='google-auth'){
    let user=await User.findOne({$or:[{email},{googleId}]}).select('+passwordHash');
    if(user?.role==='admin')return res.status(403).send('Administrator accounts must use administrator login.');
    if(user){
      if(user.status!=='active')return res.status(403).send('This account is suspended.');
      user.googleId=googleId;user.authProvider='google';await user.save({validateBeforeSave:false});
    }else{
      const {started,ends}=trialDates(),userId=await nextUserId(),{apiToken,instanceSecret}=createApiCredentials(),passwordHash=await bcrypt.hash(crypto.randomBytes(32).toString('hex'),12);
      user=await User.create({name,email,passwordHash,authProvider:'google',googleId,userId,apiToken,instanceSecret,webhookUrl:'',trialStartedAt:started,trialEndsAt:ends});
    }
    return res.redirect(`${publicWeb()}/#google_token=${encodeURIComponent(signToken(user))}`);
  }

  let user=await User.findOne({$or:[{email},{googleId}]}).select('+passwordHash');
  if(!user){
    const {started,ends}=trialDates(),userId=await nextUserId(),{apiToken,instanceSecret}=createApiCredentials(),passwordHash=await bcrypt.hash(crypto.randomBytes(32).toString('hex'),12);
    user=await User.create({name,email,passwordHash,authProvider:'google',googleId,userId,apiToken,instanceSecret,webhookUrl:'',trialStartedAt:started,trialEndsAt:ends});
  }else{
    if(user.status!=='active')return res.status(403).send('This account is suspended.');
    user.googleId=googleId;user.authProvider='google';await user.save({validateBeforeSave:false});
  }

  // Never allow a normal user to onboard using the Admin Settlement UPI, even if
  // the frontend accidentally sends the admin UPI in the OAuth query parameters.
  const adminUpi=await adminSettlementUpi();
  if(user.role!=='admin'&&adminUpi&&normalizeUpi(payload.upi)===adminUpi)return res.status(403).send('This UPI ID is reserved for the administrator. Please use your own merchant UPI ID.');

  let merchant=await Merchant.findOne({owner:user._id,upiId:payload.upi});
  if(merchant?.provider==='admin_settlement'&&user.role!=='admin')return res.status(403).send('Admin Settlement UPI cannot be used by a normal merchant account.');
  if(!merchant){
    merchant=await Merchant.create({owner:user._id,name:name||email.split('@')[0],provider:'upi_gmail',upiId:payload.upi,mobile:payload.mobile,status:'pending',verificationStatus:'verifying',verificationMessage:'Gmail authorization received. Checking the linked payment account email.'});
  }else{
    merchant.mobile=payload.mobile;
    merchant.verificationStatus='verifying';
    merchant.verificationMessage='Gmail authorization received. Checking the linked payment account email.';
    await merchant.save();
  }
  if(!tokens.refresh_token)return res.status(400).send('Google did not return a Gmail refresh token. Reconnect and grant consent again.');
  const result=await verifyMerchantGmail({merchant,client,email,refreshToken:tokens.refresh_token});
  return res.redirect(`${publicWeb()}/#google_token=${encodeURIComponent(signToken(user))}&merchant_id=${encodeURIComponent(merchant._id)}&merchant_verified=${result.verified?'1':'0'}`);
}catch(e){next(e)}});

router.post('/register',async(req,res,next)=>{try{const {name,email,password}=req.body;if(!name||!email||!password||password.length<8)return res.status(400).json({status:false,message:'Name, valid email and password of at least 8 characters are required'});const normalizedEmail=email.trim().toLowerCase();if(await User.findOne({email:normalizedEmail}))return res.status(409).json({status:false,message:'Email is already registered'});const passwordHash=await bcrypt.hash(password,12),{started,ends}=trialDates(),userId=await nextUserId(),{apiToken,instanceSecret}=createApiCredentials();const user=await User.create({userId,name:name.trim(),email:normalizedEmail,passwordHash,authProvider:'password',apiToken,instanceSecret,webhookUrl:'',trialStartedAt:started,trialEndsAt:ends});res.status(201).json({status:true,token:signToken(user),trial:{active:true,startedAt:started,endsAt:ends,durationDays:2},user:{id:user._id,userId:user.userId,name:user.name,email:user.email,role:user.role}});}catch(e){next(e)}});
router.post('/login',async(req,res,next)=>{try{const {email,password}=req.body;const user=await User.findOne({email:String(email||'').trim().toLowerCase()}).select('+passwordHash');if(!user||user.status!=='active'||!(await bcrypt.compare(password||'',user.passwordHash||'')))return res.status(401).json({status:false,message:'Invalid email or password'});const token=signToken(user);if(user.role==='admin')return res.json({status:true,token,trial:{active:false,endsAt:null},subscription:{required:false,active:true,permanent:true},user:{id:user._id,userId:user.userId||null,name:user.name,email:user.email,role:'admin'}});const trialActive=!!user.trialEndsAt&&user.trialEndsAt.getTime()>Date.now()&&!user.plan;res.json({status:true,token,trial:{active:trialActive,endsAt:user.trialEndsAt},subscription:{required:true,active:!!user.plan&&user.planStatus==='ACTIVE',permanent:false},user:{id:user._id,userId:user.userId||null,name:user.name,email:user.email,role:user.role}});}catch(e){next(e)}});
export default router;
