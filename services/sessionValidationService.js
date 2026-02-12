import prisma from './db.js';
import { decrypt } from './encryptionService.js';
import { LogService } from './logService.js';
import { emitEvent, EVENTS } from './eventBus.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export class SessionValidationService {

    /**
     * Validate a single session by email.
     * Steps:
     *  1. Check session exists
     *  2. Structural check (JSON parseable, has accessToken + expires)
     *  3. Check expires date
     *  4. (Optional) Ping OpenAI /backend-api/me with accessToken
     *
     * Returns: { status, details, checkedAt }
     *   status: 'valid' | 'expired' | 'invalid' | 'revoked' | 'no_session'
     */
    static async validateSession(email) {
        const now = new Date();

        // 1. Find session
        const session = await prisma.session.findFirst({
            where: { email },
            orderBy: { createdAt: 'desc' }
        });

        if (!session) {
            return { status: 'no_session', details: 'Сессия не найдена', checkedAt: now };
        }

        // 2. Decrypt and parse
        let parsed;
        try {
            const decrypted = decrypt(session.sessionJson);
            parsed = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
        } catch {
            await this._saveStatus(session.id, 'invalid', now);
            return { status: 'invalid', details: 'Невалидный JSON', checkedAt: now };
        }

        // 3. Structural check
        if (!parsed.accessToken) {
            await this._saveStatus(session.id, 'invalid', now);
            return { status: 'invalid', details: 'Отсутствует accessToken', checkedAt: now };
        }

        // 4. Check expires field
        if (parsed.expires) {
            const expiresDate = new Date(parsed.expires);
            if (expiresDate < now) {
                await this._saveStatus(session.id, 'expired', now);
                return { status: 'expired', details: `Токен истёк ${expiresDate.toISOString()}`, checkedAt: now };
            }
        }

        // Also check DB expiresAt
        if (session.expiresAt && new Date(session.expiresAt) < now) {
            await this._saveStatus(session.id, 'expired', now);
            return { status: 'expired', details: `Сессия истекла ${session.expiresAt.toISOString()}`, checkedAt: now };
        }

        // 5. Check how old the accessToken is (JWT decode exp if possible)
        try {
            const parts = parsed.accessToken.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                if (payload.exp) {
                    const expDate = new Date(payload.exp * 1000);
                    if (expDate < now) {
                        await this._saveStatus(session.id, 'expired', now);
                        return { status: 'expired', details: `JWT accessToken истёк ${expDate.toISOString()}`, checkedAt: now };
                    }
                }
            }
        } catch { /* not a JWT or can't decode — skip */ }

        // All checks passed
        await this._saveStatus(session.id, 'valid', now);
        return { status: 'valid', details: 'Структура и срок OK', checkedAt: now };
    }

    /**
     * Cron job: validate sessions for active users with upcoming renewals.
     * Checks only users whose nextActivationDate is within 7 days.
     * Pauses 5 seconds between each check to avoid rate limits.
     */
    static async validateUpcomingSessions() {
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Find active subscriptions with upcoming renewals
        const dueSubs = await prisma.subscription.findMany({
            where: {
                status: 'active',
                nextActivationDate: {
                    lte: sevenDaysFromNow,
                    not: null,
                },
            },
            select: { email: true, id: true },
        });

        // Also check active subs that have never been validated
        const uncheckedSessions = await prisma.session.findMany({
            where: {
                sessionStatus: null,
                email: {
                    in: (await prisma.subscription.findMany({
                        where: { status: 'active' },
                        select: { email: true },
                    })).map(s => s.email),
                },
            },
            select: { email: true },
        });

        // Merge unique emails
        const emailSet = new Set([
            ...dueSubs.map(s => s.email),
            ...uncheckedSessions.map(s => s.email),
        ]);
        const emails = [...emailSet];

        console.log(`[SessionValidator] Starting validation for ${emails.length} sessions...`);

        let validCount = 0;
        let invalidCount = 0;

        for (let i = 0; i < emails.length; i++) {
            const email = emails[i];
            try {
                const result = await this.validateSession(email);
                console.log(`[SessionValidator] [${i + 1}/${emails.length}] ${email}: ${result.status} — ${result.details}`);

                if (result.status === 'valid') {
                    validCount++;
                } else {
                    invalidCount++;
                }
            } catch (err) {
                console.error(`[SessionValidator] Error validating ${email}:`, err.message);
            }

            // No external requests — all checks are local, no pause needed
        }

        const summary = `Проверено: ${emails.length}, валидных: ${validCount}, проблемных: ${invalidCount}`;
        console.log(`[SessionValidator] Done. ${summary}`);
        await LogService.log('SESSION_VALIDATION', summary, null, { source: 'scheduler' });

        return { total: emails.length, valid: validCount, invalid: invalidCount };
    }

    /**
     * Get session status for a list of emails (for UI display).
     */
    static async getSessionStatuses(emails) {
        if (!emails || emails.length === 0) return {};

        const sessions = await prisma.session.findMany({
            where: { email: { in: emails } },
            select: {
                email: true,
                sessionStatus: true,
                sessionCheckedAt: true,
                expiresAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        // Deduplicate — keep latest session per email
        const map = {};
        for (const s of sessions) {
            if (!map[s.email]) {
                map[s.email] = {
                    status: s.sessionStatus || 'unchecked',
                    checkedAt: s.sessionCheckedAt,
                    expiresAt: s.expiresAt,
                };
            }
        }
        return map;
    }

    static async _saveStatus(sessionId, status, checkedAt) {
        await prisma.session.update({
            where: { id: sessionId },
            data: {
                sessionStatus: status,
                sessionCheckedAt: checkedAt,
            },
        });
    }
}
