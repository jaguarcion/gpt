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

        // Use select with safe fields first, fallback to core-only if new columns don't exist
        try {
            return await prisma.activityLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: Number(limit),
                select: {
                    id: true,
                    action: true,
                    details: true,
                    email: true,
                    adminIp: true,
                    source: true,
                    createdAt: true
                }
            });
        } catch (e) {
            if (e.message && (e.message.includes('adminIp') || e.message.includes('source') || e.message.includes('does not exist'))) {
                console.warn('LogService.getLogs: Falling back to core fields only (migration pending)');
                return prisma.activityLog.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    take: Number(limit),
                    select: {
                        id: true,
                        action: true,
                        details: true,
                        email: true,
                        createdAt: true
                    }
                });
            }
            throw e;
        }
    }
    static async getGroupedLogs(days = 7) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Fetch all error logs first (Prisma groupBy on text fields is limited in some DBs or requires specific version)
        // For SQLite/Prisma compatibility, we fetch and group in JS (assuming log volume isn't millions yet)
        const logs = await prisma.activityLog.findMany({
            where: {
                action: 'ERROR',
                createdAt: { gte: startDate }
            },
            select: {
                details: true,
                createdAt: true,
                email: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const groups = {};

        logs.forEach(log => {
            // Simplify details to group better (remove timestamps or unique IDs if possible? For now exact match)
            // Ideally we'd have a 'code' or 'type' field, but message is all we have.
            const msg = log.details;
            if (!groups[msg]) {
                groups[msg] = {
                    message: msg,
                    count: 0,
                    lastSeen: log.createdAt,
                    firstSeen: log.createdAt,
                    emails: new Set()
                };
            }
            const g = groups[msg];
            g.count++;
            g.groups = g.groups || []; // Could store sample IDs here
            if (new Date(log.createdAt) > new Date(g.lastSeen)) g.lastSeen = log.createdAt;
            if (new Date(log.createdAt) < new Date(g.firstSeen)) g.firstSeen = log.createdAt;
            if (log.email) g.emails.add(log.email);
        });

        return Object.values(groups)
            .map(g => ({ ...g, uniqueUsers: g.emails.size, emails: Array.from(g.emails).slice(0, 5) })) // Limit emails
            .sort((a, b) => b.count - a.count);
    }
}
