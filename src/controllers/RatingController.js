const ProviderRating=require('../models/ProviderRating');
const fileUploadService=require('../services/FileUploadService');
class RatingController{
constructor(){
this.create=this.create.bind(this);
this.index=this.index.bind(this);
}
async create(req,res){
try{
const {providerId}=req.params;
const {rating,comment}=req.body||{};
const ratingValue=Number(rating);
if(!providerId||!Number.isFinite(ratingValue)||ratingValue<1||ratingValue>5){
return res.status(422).json({success:false,message:'Dados inválidos',errors:{message:'providerId e rating(1-5) são obrigatórios'}});
}
const clientId=req.user?.id||null;
if(!clientId){
return res.status(401).json({success:false,message:'Usuário não autenticado'});
}
let attachments=null;
if(req.files&&req.files.length>0){
attachments=await fileUploadService.processUploadedFiles(req.files,req.user?.email||'unknown',`provider_rating_${providerId}`);
}
const created=await ProviderRating.create({provider_id:providerId,client_id:clientId,rating:ratingValue,comment:typeof comment==='string'?comment:null,attachments});
return res.status(201).json({success:true,message:'Avaliação enviada com sucesso',data:created});
}catch(error){
console.error('Erro ao criar avaliação:',error);
return res.status(500).json({success:false,message:'Erro interno do servidor'});
}
}
async index(req,res){
try{
const {providerId}=req.params;
if(!providerId){
return res.status(422).json({success:false,message:'Dados inválidos'});
}
const rows=await ProviderRating.listByProvider(providerId);
return res.status(200).json({success:true,message:'Avaliações listadas com sucesso',data:{data:rows,current_page:1,total:rows.length}});
}catch(error){
console.error('Erro ao listar avaliações:',error);
return res.status(500).json({success:false,message:'Erro interno do servidor'});
}
}
}
module.exports=new RatingController();
