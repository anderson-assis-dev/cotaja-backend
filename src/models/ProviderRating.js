const { pool } = require('../config/database');
class ProviderRating{
static async ensureTable(){
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
const [rows]=await connection.execute('SELECT * FROM provider_ratings WHERE provider_id=? ORDER BY created_at DESC',[String(provider_id)]);
return rows;
}finally{connection.release();}
}
}
module.exports=ProviderRating;
