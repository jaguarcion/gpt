import prisma from './services/db.js';

async function recoverKeys() {
    try {
        console.log('🔍 Searching for keys marked as problematic due to user errors...');
        
        const problematicKeys = await prisma.key.findMany({
            where: {
                status: 'problematic',
                usedByEmail: {
                    contains: 'system-error: user'
                }
            }
        });

        console.log(`Found ${problematicKeys.length} keys to recover`);

        if (problematicKeys.length === 0) {
            console.log('✅ No keys to recover. All good!');
            return;
        }

        let recovered = 0;
        for (const key of problematicKeys) {
            try {
                await prisma.key.update({
                    where: { id: key.id },
                    data: {
                        status: 'active',
                        usedAt: null,
                        usedByEmail: null
                    }
                });
                recovered++;
                console.log(`✅ Recovered key #${key.id}: ${key.code.substring(0, 10)}...`);
            } catch (e) {
                console.error(`❌ Failed to recover key #${key.id}:`, e.message);
            }
        }

        console.log(`\n🎉 Recovery complete! Recovered ${recovered}/${problematicKeys.length} keys`);
        
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

recoverKeys();
