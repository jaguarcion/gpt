
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start backfilling lifetimeActivations...');

  // 1. Get all subscriptions where lifetimeActivations is 0 but activationsCount > 0
  const subs = await prisma.subscription.findMany({
    where: {
      lifetimeActivations: 0,
      activationsCount: { gt: 0 }
    }
  });

  console.log(`Found ${subs.length} subscriptions to fix.`);

  for (const sub of subs) {
    // For existing data, we assume lifetimeActivations should be at least activationsCount.
    // However, if activationsCount was reset, we might have lost history, 
    // but at least we can recover what's there.
    // Also, if status is 'active', it means at least 1 activation.
    
    let fixValue = sub.activationsCount;
    if (fixValue === 0 && sub.status === 'active') {
        fixValue = 1;
    }

    if (fixValue > 0) {
        await prisma.subscription.update({
            where: { id: sub.id },
            data: { lifetimeActivations: fixValue }
        });
    }
  }

  console.log('Backfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
