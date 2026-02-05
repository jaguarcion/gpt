import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting data migration...');

  const now = new Date();
  
  // 1. Get all subscriptions
  const subscriptions = await prisma.subscription.findMany();
  
  console.log(`Found ${subscriptions.length} subscriptions to check.`);

  let updatedActive = 0;
  let updatedCompleted = 0;

  for (const sub of subscriptions) {
      // Calculate End Date
      const start = new Date(sub.startDate);
      const monthsToAdd = sub.type === '3m' ? 3 : 1;
      const endDate = new Date(start.setMonth(start.getMonth() + monthsToAdd));

      // Determine correct status based on dates
      const shouldBeStatus = endDate > now ? 'active' : 'completed';

      if (sub.status !== shouldBeStatus) {
          await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: shouldBeStatus }
          });
          
          if (shouldBeStatus === 'active') updatedActive++;
          else updatedCompleted++;
          
          console.log(`Updated #${sub.id} (${sub.email}): ${sub.status} -> ${shouldBeStatus}`);
      }
  }

  console.log('Migration finished!');
  console.log(`Set to Active: ${updatedActive}`);
  console.log(`Set to Completed: ${updatedCompleted}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
