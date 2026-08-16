import mongoose from 'mongoose';
const schema=new mongoose.Schema({key:{type:String,default:'global',unique:true},enabled:{type:Boolean,default:false},required:{type:Boolean,default:false},price:{type:Number,min:0,default:50},panField:{type:Boolean,default:false},aadhaarField:{type:Boolean,default:false},paymentUpiId:{type:String,default:''},paymentName:{type:String,default:'AutoGateway'}},{timestamps:true});
export default mongoose.model('KycConfig',schema);
