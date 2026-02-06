import prisma from './db.js';

export class FinanceService {
    static async getPlanConfigs() {
        const plans = ['1m', '2m', '3m'];
        let configs = await prisma.planConfig.findMany();

        // Ensure all plans exist
        if (configs.length < plans.length) {
            for (const type of plans) {
                if (!configs.find(c => c.type === type)) {
                    await prisma.planConfig.create({
                        data: { type, price: 0, cost: 0 }
                    });
                }
            }
            configs = await prisma.planConfig.findMany();
        }

        return configs;
    }

    static async updatePlanConfig(type, price, cost) {
        return prisma.planConfig.upsert({
            where: { type },
            update: { price, cost },
            create: { type, price, cost }
        });
    }

    static async recalculateHistoricalData() {
        console.log('Starting historical data recalculation...');
        // Find all subscriptions where lifetimeActivations is 0
        const subs = await prisma.subscription.findMany({
            where: {
                lifetimeActivations: 0
            }
        });

        let updatedCount = 0;

        for (const sub of subs) {
            let fixValue = 0;

            if (sub.activationsCount > 0) {
                fixValue = sub.activationsCount;
            } else {
                // If activationsCount is 0, but user exists and is not just created but has status
                // We assume 1 activation if status is active, completed or expired
                if (['active', 'completed', 'expired'].includes(sub.status)) {
                    fixValue = 1;
                }
            }

            if (fixValue > 0) {
                await prisma.subscription.update({
                    where: { id: sub.id },
                    data: { lifetimeActivations: fixValue }
                });
                updatedCount++;
            }
        }
        
        console.log(`Recalculation complete. Updated ${updatedCount} records.`);
        return { updatedCount };
    }

    static async getFinancialStats() {
        // 1. Get Configs
        const configs = await this.getPlanConfigs();
        const configMap = configs.reduce((acc, curr) => {
            acc[curr.type] = curr;
            return acc;
        }, {});

        // 2. Calculate Revenue & Profit based on lifetime activations
        // We iterate through all subscriptions to sum up
        // Note: This assumes the user's plan type was the same for all their activations.
        // For a more accurate history, we would need to store "PlanType" on a per-activation log basis,
        // but for now this approximation is acceptable.
        
        // Optimize: Group by type and sum lifetimeActivations
        const statsByType = await prisma.subscription.groupBy({
            by: ['type'],
            _sum: {
                lifetimeActivations: true
            },
            where: {
                lifetimeActivations: { gt: 0 }
            }
        });

        let totalRevenue = 0;
        let totalCost = 0;

        statsByType.forEach(stat => {
            const type = stat.type;
            const count = stat._sum.lifetimeActivations || 0;
            const config = configMap[type] || { price: 0, cost: 0 };

            totalRevenue += count * config.price;
            totalCost += count * config.cost;
        });

        const totalProfit = totalRevenue - totalCost;

        // 3. Calculate MRR (Monthly Recurring Revenue)
        // Only for ACTIVE subscriptions
        const activeSubs = await prisma.subscription.groupBy({
            by: ['type'],
            _count: {
                id: true
            },
            where: {
                status: 'active'
            }
        });

        let mrr = 0;
        activeSubs.forEach(stat => {
            const type = stat.type;
            const count = stat._count.id;
            const config = configMap[type] || { price: 0 };
            
            // Duration in months
            const duration = type === '3m' ? 3 : (type === '2m' ? 2 : 1);
            
            // MRR = (Price / Duration) * Active Count
            if (duration > 0) {
                mrr += (config.price / duration) * count;
            }
        });

        return {
            totalRevenue,
            totalCost,
            totalProfit,
            mrr,
            configs
        };
    }
}
