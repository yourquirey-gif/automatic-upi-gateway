import {Router} from 'express';
import KycConfig from '../models/KycConfig.js';
import GatewaySettings from '../models/GatewaySettings.js';
import {requireAuth,requireAdmin} from '../middleware/auth.js';
const r=Router();
r.get('/',requireAuth,async(_q,res,next)=>{try{const c=await KycConfig.findOneAndUpdate({key:'global'},{},{upsert:true,new:true,setDefaultsOnInsert:true});res.json({status:true,config:c})}catch(e){next(e)}});
r.put('/',requireAuth,requireAdmin,async(req,res,next)=>{try{const allowed=['enabled','required','price','panField','aadhaarField','paymentUpiId','paymentName'];const p=Object.fromEntries(allowed.filter(k=>k in req.body).map(k=>[k,req.body[k]]));const c=await KycConfig.findOneAndUpdate({key:'global'},p,{upsert:true,new:true,setDefaultsOnInsert:true,runValidators:true});if('required' in p)await GatewaySettings.findOneAndUpdate({key:'global'},{kycRequired:Boolean(p.required)},{upsert:true,setDefaultsOnInsert:true});res.json({status:true,config:c})}catch(e){next(e)}});
export default r;
