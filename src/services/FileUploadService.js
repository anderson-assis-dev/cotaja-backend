const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const NodeClam = require('clamscan');

class FileUploadService {
    constructor() {
        this.uploadDir = path.join(__dirname, '../../uploads');
        this.maxFileSize = 50 * 1024 * 1024; // 50MB

        // Initialize ClamAV scanner (optional - only if ClamAV is installed)
        this.clamav = null;
        this.initClamAV();
    }

    async initClamAV() {
        try {
            // Try to initialize ClamAV
            this.clamav = await new NodeClam().init({
                removeInfected: true, // Remove infected files automatically
                quarantineInfected: false,
                scanLog: null,
                debugMode: false,
                clamdscan: {
                    socket: false,
                    host: false,
                    port: false,
                },
                preference: 'clamdscan'
            });
            console.log('✅ ClamAV initialized successfully');
        } catch (error) {
            console.log('⚠️  ClamAV not available - virus scanning disabled');
            console.log('   To enable virus scanning, install ClamAV:');
            console.log('   - macOS: brew install clamav');
            console.log('   - Ubuntu: sudo apt-get install clamav clamav-daemon');
            this.clamav = null;
        }
    }

    /**
     * Create storage configuration for multer
     * Files are organized by user email and order title
     */
    createStorage(clientEmail, orderTitle) {
        return multer.diskStorage({
            destination: async (req, file, cb) => {
                try {
                    // Sanitize email and order title for folder names
                    const sanitizedEmail = this.sanitizeForFilename(clientEmail);
                    const sanitizedTitle = this.sanitizeForFilename(orderTitle);

                    // Create folder structure: uploads/email/order_title/
                    const uploadPath = path.join(this.uploadDir, sanitizedEmail, sanitizedTitle);

                    // Create directories if they don't exist
                    await fs.mkdir(uploadPath, { recursive: true });

                    cb(null, uploadPath);
                } catch (error) {
                    cb(error);
                }
            },
            filename: (req, file, cb) => {
                // Generate unique filename: timestamp_originalname
                const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname);
                const basename = path.basename(file.originalname, ext);
                const sanitizedBasename = this.sanitizeForFilename(basename);

                cb(null, `${uniqueSuffix}_${sanitizedBasename}${ext}`);
            }
        });
    }

    /**
     * File filter to validate file types
     */
    fileFilter(req, file, cb) {
        // Allowed mime types
        const allowedMimeTypes = [
            // Images
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            // Videos
            'video/mp4',
            'video/mpeg',
            'video/quicktime',
            'video/x-msvideo',
            'video/webm',
            // Documents
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain'
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`), false);
        }
    }

    /**
     * Create multer upload middleware
     */
    createUploadMiddleware(clientEmail, orderTitle) {
        return multer({
            storage: this.createStorage(clientEmail, orderTitle),
            fileFilter: this.fileFilter,
            limits: {
                fileSize: this.maxFileSize,
                files: 10 // Maximum 10 files per upload
            }
        });
    }

    /**
     * Scan file for viruses using ClamAV
     */
    async scanFileForVirus(filePath) {
        if (!this.clamav) {
            console.log('⚠️  Virus scanning skipped - ClamAV not available');
            return { isInfected: false, viruses: [] };
        }

        try {
            const { isInfected, file, viruses } = await this.clamav.scanFile(filePath);

            if (isInfected) {
                console.log(`🦠 Virus detected in file: ${filePath}`);
                console.log(`   Viruses: ${viruses.join(', ')}`);

                // Delete infected file
                try {
                    await fs.unlink(filePath);
                    console.log('🗑️  Infected file deleted');
                } catch (error) {
                    console.error('Error deleting infected file:', error);
                }
            }

            return { isInfected, viruses };
        } catch (error) {
            console.error('Error scanning file for viruses:', error);
            // Don't throw error - allow upload to continue even if scan fails
            return { isInfected: false, viruses: [], error: error.message };
        }
    }

    /**
     * Process uploaded files — move from temp to permanent organized directory.
     * Only metadata (path, name, type, size) is stored in the database.
     * Files are served via the /uploads/ static route.
     */
    async processUploadedFiles(files, clientEmail, orderTitle) {
        const processedFiles = [];

        // Create organized directory: uploads/orders/{email}/{order_title}/
        const sanitizedEmail = this.sanitizeForFilename(clientEmail || 'unknown');
        const sanitizedTitle = this.sanitizeForFilename(orderTitle || 'order');
        const finalDir = path.join(this.uploadDir, 'orders', sanitizedEmail, sanitizedTitle);

        try {
            await fs.mkdir(finalDir, { recursive: true });
        } catch (mkdirError) {
            console.error('❌ Erro ao criar diretório de uploads:', mkdirError);
            throw mkdirError;
        }

        for (const file of files) {
            try {
                // Scan for viruses
                const scanResult = await this.scanFileForVirus(file.path);

                if (scanResult.isInfected) {
                    console.log(`🦠 Arquivo infectado removido: ${file.originalname}`);
                    continue;
                }

                // Determine file type based on mimetype
                let fileType = 'document';
                if (file.mimetype && file.mimetype.startsWith('image/')) {
                    fileType = 'image';
                } else if (file.mimetype && file.mimetype.startsWith('video/')) {
                    fileType = 'video';
                }

                // Generate unique filename
                const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
                const ext = path.extname(file.originalname || 'file');
                const basename = path.basename(file.originalname || 'file', ext);
                const sanitizedBasename = this.sanitizeForFilename(basename);
                const finalFilename = `${uniqueSuffix}_${sanitizedBasename}${ext}`;

                // Move file from temp to permanent location
                const finalPath = path.join(finalDir, finalFilename);

                try {
                    // Try rename first (fastest, same filesystem)
                    await fs.rename(file.path, finalPath);
                } catch (renameError) {
                    // If rename fails (cross-device), copy + delete
                    console.log('⚠️ rename falhou, usando copy + delete:', renameError.code);
                    await fs.copyFile(file.path, finalPath);
                    try { await fs.unlink(file.path); } catch (e) { /* ignore */ }
                }

                // Build relative path for storage and URL construction
                // Path relative to uploads/ dir: orders/{email}/{title}/{filename}
                const relativePath = `orders/${sanitizedEmail}/${sanitizedTitle}/${finalFilename}`;
                const mimeType = file.mimetype || 'application/octet-stream';

                processedFiles.push({
                    filename: finalFilename,
                    original_name: file.originalname || 'file',
                    path: `uploads/${relativePath}`,
                    mime_type: mimeType,
                    size: file.size || 0,
                    type: fileType,
                    uploaded_at: new Date().toISOString()
                });

                const fileSizeMB = ((file.size || 0) / (1024 * 1024)).toFixed(2);
                console.log(`✅ Arquivo salvo em disco: ${file.originalname} (${fileSizeMB} MB) → ${relativePath}`);
            } catch (error) {
                console.error(`Erro ao processar arquivo ${file.originalname}:`, error);
                // Try to clean up temp file
                try { await fs.unlink(file.path); } catch (e) { /* ignore */ }
            }
        }

        return processedFiles;
    }

    /**
     * Sanitize string for use in filenames
     * Replace special characters and spaces
     */
    sanitizeForFilename(str) {
        return str
            .toLowerCase()
            .replace(/@/g, '_') // Replace @ with _
            .replace(/[^a-z0-9_-]/g, '_') // Replace special chars with _
            .replace(/_+/g, '_') // Replace multiple _ with single _
            .replace(/^_|_$/g, ''); // Remove leading/trailing _
    }

    /**
     * Delete files from filesystem
     * Handles both absolute and relative paths (e.g., "uploads/orders/...")
     */
    async deleteFiles(filePaths) {
        const results = [];

        for (let filePath of filePaths) {
            try {
                // If relative path, resolve from project root
                if (!path.isAbsolute(filePath)) {
                    filePath = path.resolve(filePath);
                }
                await fs.unlink(filePath);
                results.push({ path: filePath, deleted: true });
                console.log(`🗑️ Arquivo deletado: ${filePath}`);
            } catch (error) {
                console.error(`Error deleting file ${filePath}:`, error.message);
                results.push({ path: filePath, deleted: false, error: error.message });
            }
        }

        return results;
    }

    /**
     * Delete entire order folder
     */
    async deleteOrderFolder(clientEmail, orderTitle) {
        try {
            const sanitizedEmail = this.sanitizeForFilename(clientEmail);
            const sanitizedTitle = this.sanitizeForFilename(orderTitle);
            const folderPath = path.join(this.uploadDir, sanitizedEmail, sanitizedTitle);

            await fs.rm(folderPath, { recursive: true, force: true });
            console.log(`🗑️  Deleted order folder: ${folderPath}`);
            return true;
        } catch (error) {
            console.error('Error deleting order folder:', error);
            return false;
        }
    }
}

module.exports = new FileUploadService();
