import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixKeyRelations() {
    console.log('Starting key relation fix...');
    
    // 1. Get all used keys that have an email assigned
    const usedKeys = await prisma.key.findMany({
        where: {
            status: 'used',
            NOT: {
                usedByEmail: null
            }
        }
    });

    console.log(`Found ${usedKeys.length} used keys with emails.`);
    
    let fixedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const key of usedKeys) {
        // 2. Find the correct subscription for this email
        // We take the most recent one if duplicates exist
        const correctSubscription = await prisma.subscription.findFirst({
            where: { email: key.usedByEmail },
            orderBy: { createdAt: 'desc' }
        });

        if (correctSubscription) {
            // 3. Check if it needs fixing
            if (key.subscriptionId !== correctSubscription.id) {
                console.log(`Fixing Key #${key.id} (${key.code}):`);
                console.log(`   Current Sub ID: ${key.subscriptionId} (Email: ${key.usedByEmail})`);
                console.log(`   Correct Sub ID: ${correctSubscription.id} (Found by email)`);
                
                await prisma.key.update({
                    where: { id: key.id },
                    data: { subscriptionId: correctSubscription.id }
                });
                fixedCount++;
            } else {
                skippedCount++;
            }
        } else {
            console.warn(`⚠️ Warning: No subscription found for email ${key.usedByEmail} (Key #${key.id})`);
            // Detach if no user found to prevent confusion
            if (key.subscriptionId !== null) {
                console.log(`   Detaching Key #${key.id} from Sub ID ${key.subscriptionId} (User not found)`);
                await prisma.key.update({
                    where: { id: key.id },
                    data: { subscriptionId: null }
                });
                fixedCount++;
            }
            errorCount++;
        }
    }

    console.log('------------------------------------------------');
    console.log(`Finished.`);
    console.log(`Fixed/Updated: ${fixedCount}`);
    console.log(`Skipped (Correct): ${skippedCount}`);
    console.log(`No Subscription Found: ${errorCount}`);
}

fixKeyRelations()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
