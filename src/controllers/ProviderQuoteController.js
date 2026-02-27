const { pool }=require('../config/database');
const User=require('../models/User');
const Notification=require('../models/Notification');
const PushNotificationService=require('../services/PushNotificationService');
const emailService=require('../services/EmailService');
class ProviderQuoteController{
constructor(){
this.requestQuote=this.requestQuote.bind(this);
}
async requestQuote(req,res){
try{
const {providerId}=req.params;
if(!providerId)return res.status(422).json({success:false,message:'Dados inválidos'});
const client=req.user;
if(!client?.id)return res.status(401).json({success:false,message:'Usuário não autenticado'});
const provider=await User.findById(providerId);
if(!provider||provider?.profile_type!=='provider')return res.status(404).json({success:false,message:'Prestador não encontrado'});
const connection=await pool.getConnection();
let orders=[];
try{
const [rows]=await connection.execute('SELECT id,title,category,status FROM orders WHERE client_id=? AND status IN (?,?) ORDER BY created_at DESC',[String(client.id),'open','in_progress']);
orders=Array.isArray(rows)?rows:[];
}finally{connection.release();}
if(orders.length===0)return res.status(422).json({success:false,message:'Primeiro você precisa cadastrar um pedido para depois solicitar orçamento'});
const titles=orders.map(o=>o.title).filter(Boolean);
const baseMessage=`${client.name||'Cliente'} solicitou orçamento para ${orders.length} demanda(s)`;
const preview=titles.slice(0,3).join(', ');
let message=baseMessage;
if(preview){
const suffix=orders.length>3?'...':'';
message=`${baseMessage}: ${preview}${suffix}`;
}
let notification=null;
try{
notification=await Notification.create({user_id:provider.id,type:'quote_request',title:'Solicitação de orçamento',message,data:{client_id:String(client.id),client_name:client.name||'Cliente',provider_id:String(provider.id),orders:orders.map(o=>({id:o.id,title:o.title,category:o.category,status:o.status}))}});
}catch(e){console.error('Erro ao criar notificação de solicitação:',e);}
let pushSent=false;
let emailSent=false;
const tasks=[];
if(provider.fcm_token){
const pushService=new PushNotificationService();
tasks.push({key:'push',promise:pushService.sendAlert({registration_id:provider.fcm_token,device:provider.device_platform||'ios',title:'Solicitação de orçamento',message,sound:'default',extra_data:{type:'quote_request',provider_id:String(provider.id),client_id:String(client.id)}})});
}
if(provider.email){
tasks.push({key:'email',promise:emailService.sendQuoteRequestToProvider(provider,client,orders)});
}
if(tasks.length>0){
const results=await Promise.allSettled(tasks.map(t=>t.promise));
for(let i=0;i<results.length;i++){
const r=results[i];
const k=tasks[i].key;
if(r.status==='fulfilled'){
if(k==='push')pushSent=true;
if(k==='email')emailSent=true;
}else{
console.error(`Erro ao enviar ${k} de solicitação:`,r.reason?.message||r.reason);
}
}
}
return res.status(200).json({success:true,message:'Solicitação enviada com sucesso',data:{pushSent,emailSent,orders,notification}});
}catch(error){
console.error('Erro ao solicitar orçamento:',error);
return res.status(500).json({success:false,message:'Erro interno do servidor'});
}
}
}
module.exports=new ProviderQuoteController();
