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
     * Process uploaded files - scan for viruses and return file metadata
     * Moves files from temp to final location
     */
    async processUploadedFiles(files, clientEmail, orderTitle) {
        const processedFiles = [];
        const path = require('path');

        // Create final directory
        const sanitizedEmail = this.sanitizeForFilename(clientEmail);
        const sanitizedTitle = this.sanitizeForFilename(orderTitle);
        const finalDir = path.join(this.uploadDir, sanitizedEmail, sanitizedTitle);

        try {
            await fs.mkdir(finalDir, { recursive: true });
        } catch (error) {
            console.error('Erro ao criar diretório:', error);
            throw error;
        }

        for (const file of files) {
            try {
                // Scan for viruses
                const scanResult = await this.scanFileForVirus(file.path);

                if (scanResult.isInfected) {
                    // Skip infected files
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
                const ext = path.extname(file.originalname || '');
                const uniqueName = `${Date.now()}_${Math.round(Math.random() * 1E9)}${ext}`;
                const finalPath = path.join(finalDir, uniqueName);

                // Move file from temp to final location
                await fs.rename(file.path, finalPath);

                processedFiles.push({
                    filename: uniqueName,
                    original_name: file.originalname || 'file',
                    path: finalPath.replace(/\\/g, '/'), // Normalize path separators
                    mime_type: file.mimetype || 'application/octet-stream',
                    size: file.size || 0,
                    type: fileType,
                    uploaded_at: new Date().toISOString()
                });

                console.log(`✅ Arquivo processado: ${file.originalname} → ${uniqueName}`);
            } catch (error) {
                console.error(`Erro ao processar arquivo ${file.originalname}:`, error);
                // Continue processing other files
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
     */
    async deleteFiles(filePaths) {
        const results = [];

        for (const filePath of filePaths) {
            try {
                await fs.unlink(filePath);
                results.push({ path: filePath, deleted: true });
            } catch (error) {
                console.error(`Error deleting file ${filePath}:`, error);
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
