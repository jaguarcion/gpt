
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Debugging Data ---');
  
  // 1. Check Subscription Types
  const types = await prisma.subscription.groupBy({
    by: ['type'],
    _count: { id: true },
    _sum: { lifetimeActivations: true }
  });
  console.log('Subscription Types found:', JSON.stringify(types, null, 2));

  // 2. Check Plan Configs
  const configs = await prisma.planConfig.findMany();
  console.log('Plan Configs found:', JSON.stringify(configs, null, 2));

  // 3. Check sample subscription
  const sample = await prisma.subscription.findFirst();
  console.log('Sample Subscription:', sample);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
