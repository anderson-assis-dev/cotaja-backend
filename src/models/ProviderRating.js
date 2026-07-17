const { pool } = require('../config/database');
class ProviderRating{
// A criação da tabela roda uma única vez por processo. A promise é cacheada, então
// chamadas repetidas (inclusive de dentro de requisições) retornam sem tocar o banco.
static _ensurePromise=null;
static ensureTable(){
if(!ProviderRating._ensurePromise){
ProviderRating._ensurePromise=ProviderRating._createTable().catch(err=>{
// Se falhar, permite nova tentativa numa próxima chamada.
ProviderRating._ensurePromise=null;
throw err;
});
}
return ProviderRating._ensurePromise;
}
static async _createTable(){
const connection=await pool.getConnection();
try{
await connection.execute(`CREATE TABLE IF NOT EXISTS provider_ratings(id INT AUTO_INCREMENT PRIMARY KEY,provider_id VARCHAR(36) NOT NULL,client_id VARCHAR(36) NOT NULL,rating INT NOT NULL,comment TEXT NULL,attachments LONGTEXT NULL,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_provider_id(provider_id),INDEX idx_client_id(client_id))`);
}finally{connection.release();}
}
static async create({provider_id,client_id,rating,comment,attachments}){
await ProviderRating.ensureTable();
const connection=await pool.getConnection();
try{
const attachmentsValue=attachments?JSON.stringify(attachments):null;
const [result]=await connection.execute(`INSERT INTO provider_ratings(provider_id,client_id,rating,comment,attachments,created_at,updated_at) VALUES(?,?,?,?,?,NOW(),NOW())`,[String(provider_id),String(client_id),Number(rating),comment||null,attachmentsValue]);
const [rows]=await connection.execute('SELECT * FROM provider_ratings WHERE id=?',[result.insertId]);
return rows[0]||null;
}finally{connection.release();}
}
static async listByProvider(provider_id){
await ProviderRating.ensureTable();
const connection=await pool.getConnection();
try{
const [rows]=await connection.execute('SELECT pr.*,u.name client_name,u.avatar_base64 client_avatar_base64 FROM provider_ratings pr LEFT JOIN users u ON u.id=pr.client_id WHERE pr.provider_id=? ORDER BY pr.created_at DESC',[String(provider_id)]);
return rows;
}finally{connection.release();}
}
static async getStatsForProviders(providerIds){
await ProviderRating.ensureTable();
const ids=Array.isArray(providerIds)?providerIds.map(String).filter(Boolean):[];
if(ids.length===0)return new Map();
const connection=await pool.getConnection();
try{
const placeholders=ids.map(()=>'?').join(',');
const [rows]=await connection.execute(`SELECT provider_id,COUNT(*) ratings_count,AVG(rating) avg_rating FROM provider_ratings WHERE provider_id IN (${placeholders}) GROUP BY provider_id`,ids);
const map=new Map();
for(const r of rows){
map.set(String(r.provider_id),{ratings_count:Number(r.ratings_count)||0,avg_rating:r.avg_rating==null?0:Number(r.avg_rating)});
}
return map;
}finally{connection.release();}
}
}
module.exports=ProviderRating;
