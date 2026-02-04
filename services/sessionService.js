import prisma from './db.js';

export class SessionService {
    static async createSession(email, sessionJson, expiresAt, telegramId) {
        return prisma.session.create({
            data: {
                email,
                sessionJson: JSON.stringify(sessionJson),
                expiresAt,
                telegramId: BigInt(telegramId) // Prisma uses BigInt for SQLite Integer/BigInt
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
