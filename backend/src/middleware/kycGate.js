import GatewaySettings from '../models/GatewaySettings.js';
import User from '../models/User.js';
export async function requireKycIfEnabled(req,res,next){try{const s=await GatewaySettings.findOne({key:'global'});if(!s?.kycRequired)return next();const u=await User.findById(req.auth.sub).select('kycStatus');if(u?.kycStatus!=='VERIFIED')return res.status(403).json({status:false,code:'KYC_REQUIRED',message:'Complete KYC to continue'});next()}catch(e){next(e)}}
