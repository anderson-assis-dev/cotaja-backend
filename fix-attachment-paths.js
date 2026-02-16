/**
 * Fix attachment paths in the database.
 * Converts absolute Windows paths to relative paths.
 *
 * Before: "C:/Users/Administrador/Desktop/cotaja/uploads/email/title/file.jpg"
 * After:  "uploads/email/title/file.jpg"
 */
const { pool } = require('./src/config/database');

(async () => {
  try {
    const conn = await pool.getConnection();

    // Find all orders with attachments
    const [rows] = await conn.execute('SELECT id, attachments FROM orders WHERE attachments IS NOT NULL');

    console.log(`Found ${rows.length} orders with attachments`);

    for (const row of rows) {
      let attachments;
      try {
        attachments = typeof row.attachments === 'string'
          ? JSON.parse(row.attachments)
          : row.attachments;
      } catch (e) {
        console.log(`  Order #${row.id}: Invalid JSON, skipping`);
        continue;
      }

      if (!Array.isArray(attachments)) continue;

      let changed = false;
      const fixedAttachments = attachments.map(att => {
        if (att.path) {
          const uploadsIdx = att.path.indexOf('uploads/');
          if (uploadsIdx > 0) {
            // Has absolute prefix before "uploads/" — make it relative
            const newPath = att.path.substring(uploadsIdx);
            console.log(`  Order #${row.id}: "${att.path}" → "${newPath}"`);
            att.path = newPath;
            changed = true;
          }
        }
        return att;
      });

      if (changed) {
        await conn.execute(
          'UPDATE orders SET attachments = ? WHERE id = ?',
          [JSON.stringify(fixedAttachments), row.id]
        );
        console.log(`  ✅ Order #${row.id} updated!`);
      } else {
        console.log(`  Order #${row.id}: paths already relative, no changes needed`);
      }
    }

    conn.release();
    console.log('\nDone!');
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();
