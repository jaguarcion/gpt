
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

const DB_PATH = path.join(process.cwd(), 'prisma', 'dev.db');
const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 18;

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

const createBackup = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `dev_backup_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    try {
        // Copy file
        fs.copyFileSync(DB_PATH, backupPath);
        console.log(`[Backup] Created: ${backupName}`);

        // Cleanup old backups
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('dev_backup_') && file.endsWith('.db'))
            .map(file => ({
                name: file,
                time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Newest first

        if (files.length > MAX_BACKUPS) {
            const toDelete = files.slice(MAX_BACKUPS);
            toDelete.forEach(file => {
                fs.unlinkSync(path.join(BACKUP_DIR, file.name));
                console.log(`[Backup] Deleted old backup: ${file.name}`);
            });
        }

    } catch (e) {
        console.error('[Backup] Error:', e.message);
    }
};

// Run every 4 hours
// Cron pattern: "0 */4 * * *" (At minute 0 past every 4th hour)
cron.schedule('0 */4 * * *', () => {
    console.log('[Backup] Starting scheduled backup...');
    createBackup();
});

console.log(`[Backup] Service started. Backups will run every 4 hours. Max backups: ${MAX_BACKUPS}`);

// Create immediate backup on start
createBackup();
