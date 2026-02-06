import prisma from './db.js';

export class LogService {
    static async log(action, details = '', email = null) {
        try {
            // Ensure details is a string if it's an object
            const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details);
            
            await prisma.activityLog.create({
                data: {
                    action,
                    details: detailsStr,
                    email
                }
            });
        } catch (e) {
            console.error('Failed to write log:', e);
            // Don't throw, just log error so main flow isn't interrupted
        }
    }

    static async getLogs(limit = 50, type = '', search = '') {
        const where = {};
        
        if (type) {
            if (type === 'ADMIN_ACTIONS') {
                where.action = { in: ['ADMIN_LOGIN', 'USER_EDIT', 'KEY_ADDED', 'MANUAL_ACTIVATION', 'BACKUP', 'USER_DELETE'] };
            } else {
                where.action = type;
            }
        }
        
        if (search) {
            where.OR = [
                { email: { contains: search } },
                { details: { contains: search } }
            ];
        }

        return prisma.activityLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Number(limit)
        });
    }
}
