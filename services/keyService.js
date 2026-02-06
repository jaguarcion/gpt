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

    static async getAllKeys(page = 1, limit = 20, status = 'all') {
        if (limit === -1) {
             return prisma.key.findMany({
                orderBy: { createdAt: 'desc' }
             });
        }
        
        const skip = (page - 1) * limit;
        const where = {};
        
        if (status !== 'all') {
            where.status = status;
        }

        const [keys, total] = await Promise.all([
            prisma.key.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.key.count({ where })
        ]);

        return { keys, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    static async deleteKey(id) {
        return prisma.key.delete({
            where: { id: Number(id) }
        });
    }

    static async getStats() {
        const total = await prisma.key.count();
        const active = await prisma.key.count({ where: { status: 'active' } });
        const used = await prisma.key.count({ where: { status: 'used' } });
        
        return { total, active, used };
    }

    static async getInventoryStats() {
        const total = await prisma.key.count();
        const active = await prisma.key.count({ where: { status: 'active' } });
        const used = await prisma.key.count({ where: { status: 'used' } });

        // Calculate burn rate (usage in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentUsage = await prisma.key.findMany({
            where: {
                status: 'used',
                usedAt: {
                    gte: thirtyDaysAgo
                }
            },
            select: {
                usedAt: true
            }
        });

        // Group by day
        const dailyUsage = {};
        // Initialize last 30 days with 0
        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            dailyUsage[dateStr] = 0;
        }

        recentUsage.forEach(k => {
            if (k.usedAt) {
                const dateStr = k.usedAt.toISOString().split('T')[0];
                if (dailyUsage[dateStr] !== undefined) {
                    dailyUsage[dateStr]++;
                }
            }
        });

        // Convert to array for chart
        const chartData = Object.entries(dailyUsage)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Calculate average burn rate (last 7 days for more immediate runway)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const last7DaysCount = recentUsage.filter(k => k.usedAt && k.usedAt >= sevenDaysAgo).length;
        const avgBurnRate = last7DaysCount / 7; // keys per day

        const runwayDays = avgBurnRate > 0 ? Math.floor(active / avgBurnRate) : 999;

        return {
            summary: {
                total,
                active,
                used,
                burnRate7d: parseFloat(avgBurnRate.toFixed(2)),
                runwayDays
            },
            chart: chartData
        };
    }
}
