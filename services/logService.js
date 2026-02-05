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

    static async getLogs(limit = 50) {
        return prisma.activityLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }
}
