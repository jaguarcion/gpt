import prisma from './db.js';

export class KeyService {
    static normalizeCodes(input) {
        const values = Array.isArray(input) ? input : [input];
        const normalized = [];

        for (const value of values) {
            if (typeof value !== 'string') continue;

            const parts = value
                .split(/[\s,;]+/)
                .map(part => part.trim())
                .filter(Boolean);

            normalized.push(...parts);
        }

        return normalized;
    }

    static async addKey(code) {
        return prisma.key.create({
            data: {
                code: code.trim(),
                status: 'active'
            }
        });
    }

    static async inspectExistingKeys(codes, sampleLimit = 20) {
        const normalizedCodes = this.normalizeCodes(codes);
        const uniqueCodes = [...new Set(normalizedCodes)];
        const duplicateInPayloadCount = normalizedCodes.length - uniqueCodes.length;

        if (uniqueCodes.length === 0) {
            return {
                received: 0,
                unique: 0,
                duplicateInPayloadCount: 0,
                existingCount: 0,
                missingCount: 0,
                existingCodes: new Set(),
                existingRecords: [],
                sampleExisting: [],
                missingSample: []
            };
        }

        const existingRecords = await prisma.key.findMany({
            where: {
                code: {
                    in: uniqueCodes
                }
            },
            select: {
                id: true,
                code: true,
                status: true,
                createdAt: true,
                usedAt: true,
                usedByEmail: true,
                subscriptionId: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const existingCodes = new Set(existingRecords.map(record => record.code));
        const missingCodes = uniqueCodes.filter(code => !existingCodes.has(code));

        return {
            received: normalizedCodes.length,
            unique: uniqueCodes.length,
            duplicateInPayloadCount,
            existingCount: existingRecords.length,
            missingCount: missingCodes.length,
            existingCodes,
            existingRecords,
            sampleExisting: existingRecords.slice(0, sampleLimit),
            missingSample: missingCodes.slice(0, sampleLimit)
        };
    }

    static async addKeys(codes) {
        const inspection = await this.inspectExistingKeys(codes, 10);
        const normalizedCodes = this.normalizeCodes(codes);
        const codesToInsert = [...new Set(normalizedCodes)].filter(code => !inspection.existingCodes.has(code));

        let addedCount = 0;
        let failedCount = 0;
        const errorSamples = [];

        for (const code of codesToInsert) {
            try {
                await prisma.key.create({
                    data: { code, status: 'active' }
                });
                addedCount++;
            } catch (e) {
                failedCount++;
                if (errorSamples.length < 5) {
                    errorSamples.push({ code, message: e.message });
                }
                console.error(`Failed to add key ${code}:`, e.message);
            }
        }

        const result = {
            count: addedCount,
            inserted: addedCount,
            received: inspection.received,
            unique: inspection.unique,
            skipped: inspection.existingCount + inspection.duplicateInPayloadCount,
            skippedExisting: inspection.existingCount,
            skippedDuplicateInPayload: inspection.duplicateInPayloadCount,
            failed: failedCount,
            errorSamples,
            sampleExisting: inspection.sampleExisting
        };

        console.info('[KeyImport] addKeys summary', result);

        return result;
    }

    static async getAvailableKey() {
        return prisma.key.findFirst({
            where: {
                status: 'active'
            }
        });
    }

    static async markKeyAsProblematic(id, reason) {
        return prisma.key.update({
            where: { id },
            data: {
                status: 'problematic',
                usedAt: new Date(), // Mark as "used" so it doesn't get picked up again, but with status 'problematic'
                usedByEmail: `system-error: ${reason}`.substring(0, 100)
            }
        });
    }

    static async cleanupKeys() {
        // 1. Trim all active keys
        const allKeys = await prisma.key.findMany({ where: { status: 'active' } });
        let trimmed = 0;
        for (const k of allKeys) {
            if (k.code !== k.code.trim()) {
                try {
                    await prisma.key.update({
                        where: { id: k.id },
                        data: { code: k.code.trim() }
                    });
                    trimmed++;
                } catch (e) {
                    console.error(`Failed to trim key ${k.id}:`, e.message);
                }
            }
        }
        return { trimmed };
    }

    static async recoverUserErrorKeys() {
        // Find keys marked as problematic due to user errors (not key errors)
        const problematicKeys = await prisma.key.findMany({
            where: {
                status: 'problematic',
                usedByEmail: {
                    contains: 'system-error: user'
                }
            }
        });

        let recovered = 0;
        for (const key of problematicKeys) {
            try {
                await prisma.key.update({
                    where: { id: key.id },
                    data: {
                        status: 'active',
                        usedAt: null,
                        usedByEmail: null,
                        usedValidationCheckedAt: null
                    }
                });
                recovered++;
                console.log(`Recovered key ${key.id}: ${key.code}`);
            } catch (e) {
                console.error(`Failed to recover key ${key.id}:`, e.message);
            }
        }

        return { recovered, total: problematicKeys.length };
    }

    static async markKeyAsUsed(id, email, subscriptionId) {
        return prisma.key.update({
            where: { id },
            data: {
                status: 'used',
                usedAt: new Date(),
                usedByEmail: email,
                subscriptionId: subscriptionId,
                usedValidationCheckedAt: null
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

    static async deleteActiveKeys() {
        const result = await prisma.key.deleteMany({
            where: { status: 'active' }
        });
        return { deleted: result.count };
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
