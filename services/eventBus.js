import { EventEmitter } from 'events';

// Central event bus for SSE broadcasting
const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

// Event types
export const EVENTS = {
    ACTIVATION: 'activation',
    RENEWAL: 'renewal',
    ERROR: 'error',
    KEY_ADDED: 'key_added',
    KEY_LOW: 'key_low',
    SUBSCRIPTION_CREATED: 'subscription_created',
    SUBSCRIPTION_UPDATED: 'subscription_updated',
    SUBSCRIPTION_DELETED: 'subscription_deleted',
    STATS_UPDATE: 'stats_update',
    BATCH_START: 'batch_start',
    BATCH_PROGRESS: 'batch_progress',
    BATCH_COMPLETE: 'batch_complete',
};

export function emitEvent(type, data) {
    eventBus.emit('sse', { type, data, timestamp: new Date().toISOString() });
}

export default eventBus;
