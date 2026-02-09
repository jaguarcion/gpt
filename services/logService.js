import prisma from './db.js';

export class LogService {
    static async log(action, details = '', email = null, { adminIp = null, source = null } = {}) {
        try {
            // Ensure details is a string if it's an object
            const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details);
            
            // Build data object conditionally to avoid errors if fields don't exist in DB
            const data = {
                action,
                details: detailsStr,
                email
            };
            
            // Only add adminIp and source if they are provided (and DB schema supports them)
            // This prevents errors in production if migration hasn't been run yet
            if (adminIp !== null && adminIp !== undefined) {
                data.adminIp = adminIp;
            }
            if (source !== null && source !== undefined) {
                data.source = source;
            }
            
            try {
                await prisma.activityLog.create({ data });
            } catch (prismaError) {
                // If error is about unknown fields (adminIp/source), retry without them
                if (prismaError.message && (prismaError.message.includes('adminIp') || prismaError.message.includes('source') || prismaError.message.includes('Unknown argument'))) {
                    console.warn('LogService: Retrying log creation without adminIp/source fields (DB schema may not support them)');
                    await prisma.activityLog.create({
                        data: {
                            action,
                            details: detailsStr,
                            email
                        }
                    });
                } else {
                    throw prismaError; // Re-throw if it's a different error
                }
            }
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
                // Removed adminIp from search to avoid errors if field doesn't exist in DB
            ];
        }

        return prisma.activityLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: Number(limit)
        });
    }
}
