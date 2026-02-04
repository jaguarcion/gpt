import prisma from './db.js';

export class SessionService {
    static async createSession(email, sessionJson, expiresAt, telegramId) {
        const existingSession = await prisma.session.findFirst({
            where: { email },
            orderBy: { createdAt: 'desc' }
        });

        if (existingSession) {
            return prisma.session.update({
                where: { id: existingSession.id },
                data: {
                    sessionJson: JSON.stringify(sessionJson),
                    expiresAt,
                    telegramId: BigInt(telegramId)
                }
            });
        }

        return prisma.session.create({
            data: {
                email,
                sessionJson: JSON.stringify(sessionJson),
                expiresAt,
                telegramId: BigInt(telegramId)
            }
        });
    }

    static async getSessionByEmail(email) {
        const session = await prisma.session.findFirst({
            where: { email },
            orderBy: { createdAt: 'desc' }
        });
        
        if (session && session.sessionJson) {
            session.sessionJson = JSON.parse(session.sessionJson);
        }
        return session;
    }
}
