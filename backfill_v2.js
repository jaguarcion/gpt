
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start backfilling lifetimeActivations (Aggressive Mode)...');

  // Find ALL subscriptions where lifetimeActivations is 0
  // We want to fix them even if activationsCount is 0, assuming if they exist, they paid at least once.
  const subs = await prisma.subscription.findMany({
    where: {
      lifetimeActivations: 0
    }
  });

  console.log(`Found ${subs.length} subscriptions with 0 lifetime activations.`);

  let updatedCount = 0;

  for (const sub of subs) {
    let fixValue = 0;

    // Logic to determine historical activations
    if (sub.activationsCount > 0) {
        fixValue = sub.activationsCount;
    } else {
        // If activationsCount is 0, but user exists, they probably bought at least the initial sub.
        // We assume 1 activation if status is active or completed.
        if (sub.status === 'active' || sub.status === 'completed' || sub.status === 'expired') {
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

  console.log(`Successfully updated ${updatedCount} subscriptions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
