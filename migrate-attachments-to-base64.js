/**
 * Migration script: Convert existing file-path-based attachments to base64 data URIs.
 *
 * This script reads each order's attachments JSON, finds the image files on disk,
 * converts them to base64 data URIs, and updates the database.
 *
 * If a file is not found on disk, it keeps the old entry but marks it as missing.
 *
 * Usage: node migrate-attachments-to-base64.js
 */
const { pool } = require('./src/config/database');
const fs = require('fs').promises;
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, 'uploads');

async function migrateAttachments() {
  const conn = await pool.getConnection();

  try {
    const [rows] = await conn.execute('SELECT id, attachments FROM orders WHERE attachments IS NOT NULL');
    console.log(`Found ${rows.length} orders with attachments\n`);

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

      if (!Array.isArray(attachments) || attachments.length === 0) {
        console.log(`  Order #${row.id}: No attachments array, skipping`);
        continue;
      }

      console.log(`  Order #${row.id}: Processing ${attachments.length} attachments...`);

      let changed = false;
      const migratedAttachments = [];

      for (const att of attachments) {
        // Already migrated to base64?
        if (att.data && att.data.startsWith('data:')) {
          console.log(`    ✅ "${att.original_name || att.filename}" — already base64`);
          migratedAttachments.push(att);
          continue;
        }

        // Try to find the file on disk
        const rawPath = att.path || '';

        // Try multiple path resolutions
        const pathsToTry = [
          rawPath,                                          // as-is
          path.join(__dirname, rawPath),                     // relative to project
          path.resolve(rawPath),                             // absolute
        ];

        // Also try extracting "uploads/..." portion
        const uploadsIdx = rawPath.indexOf('uploads/');
        if (uploadsIdx !== -1) {
          const relativePart = rawPath.substring(uploadsIdx);
          pathsToTry.push(path.join(__dirname, relativePart));
        }

        let fileBuffer = null;
        let foundPath = null;

        for (const tryPath of pathsToTry) {
          try {
            fileBuffer = await fs.readFile(tryPath);
            foundPath = tryPath;
            break;
          } catch (e) {
            // file not found at this path, try next
          }
        }

        if (fileBuffer) {
          // Convert to base64
          const base64Data = fileBuffer.toString('base64');
          const mimeType = att.mime_type || 'application/octet-stream';
          const dataUri = `data:${mimeType};base64,${base64Data}`;

          migratedAttachments.push({
            filename: att.original_name || att.filename,
            original_name: att.original_name || att.filename,
            data: dataUri,
            mime_type: mimeType,
            size: att.size || fileBuffer.length,
            type: att.type || 'document',
            uploaded_at: att.uploaded_at || new Date().toISOString(),
          });

          changed = true;
          console.log(`    ✅ "${att.original_name || att.filename}" — converted to base64 (${(base64Data.length / 1024).toFixed(1)} KB)`);
        } else {
          // File not found — keep old entry with a warning
          console.log(`    ⚠️  "${att.original_name || att.filename}" — FILE NOT FOUND, keeping old entry`);
          console.log(`       Tried paths: ${rawPath}`);
          migratedAttachments.push(att);
        }
      }

      if (changed) {
        await conn.execute(
          'UPDATE orders SET attachments = ? WHERE id = ?',
          [JSON.stringify(migratedAttachments), row.id]
        );
        console.log(`  💾 Order #${row.id} updated in database!\n`);
      } else {
        console.log(`  Order #${row.id}: No changes needed\n`);
      }
    }

    console.log('✅ Migration complete!');
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrateAttachments();
