import prisma from './db.js';

export class KeyService {
    static async addKey(code) {
        return prisma.key.create({
            data: {
                code,
                status: 'active'
            }
        });
    }

    static async addKeys(codes) {
        // Create multiple keys. SQLite doesn't support createMany nicely with unique constraints in Prisma sometimes,
        // but let's try standard createMany. It skips duplicates only if supported, but Prisma throws error on duplicate unique.
        // We will filter existing first or catch errors.
        // Simple approach: loop and create, ignoring errors. Or createMany.
        // createMany is supported in SQLite since Prisma 2.x, but it doesn't return created records.
        // Also it throws if ANY unique constraint fails.
        // So we should probably do one by one or filter first.
        
        let addedCount = 0;
        for (const code of codes) {
            try {
                // Check if exists
                const existing = await prisma.key.findUnique({ where: { code } });
                if (!existing) {
                    await prisma.key.create({
                        data: { code, status: 'active' }
                    });
                    addedCount++;
                }
            } catch (e) {
                console.error(`Failed to add key ${code}:`, e.message);
            }
        }
        return { count: addedCount };
    }

    static async getAvailableKey() {
        return prisma.key.findFirst({
            where: {
                status: 'active'
            }
        });
    }

    static async markKeyAsUsed(id, email, subscriptionId) {
        return prisma.key.update({
            where: { id },
            data: {
                status: 'used',
                usedAt: new Date(),
                usedByEmail: email,
                subscriptionId: subscriptionId
            }
        });
    }

    static async getAllKeys() {
        return prisma.key.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }

    static async getStats() {
        const total = await prisma.key.count();
        const active = await prisma.key.count({ where: { status: 'active' } });
        const used = await prisma.key.count({ where: { status: 'used' } });
        
        return { total, active, used };
    }
}
