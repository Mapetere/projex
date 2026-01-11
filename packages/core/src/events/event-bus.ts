/**
 * Simple in-memory event bus with pub/sub pattern.
 * Events are processed synchronously in subscription order.
 */

import type { SignalEvent, EventType } from './types.js';

type EventHandler<T extends SignalEvent = SignalEvent> = (event: T) => void | Promise<void>;

interface Subscription {
    id: string;
    eventTypes: EventType[] | '*';
    handler: EventHandler;
}

export class EventBus {
    private subscriptions: Subscription[] = [];
    private eventLog: SignalEvent[] = [];
    private subscriptionIdCounter = 0;

    /**
     * Subscribe to specific event types or all events ('*')
     */
    subscribe(
        eventTypes: EventType[] | '*',
        handler: EventHandler
    ): () => void {
        const id = `sub_${++this.subscriptionIdCounter}`;
        const subscription: Subscription = { id, eventTypes, handler };
        this.subscriptions.push(subscription);

        // Return unsubscribe function
        return () => {
            this.subscriptions = this.subscriptions.filter(s => s.id !== id);
        };
    }

    /**
     * Publish an event to all matching subscribers
     */
    async publish(event: SignalEvent): Promise<void> {
        this.eventLog.push(event);

        const matchingSubscriptions = this.subscriptions.filter(sub => {
            if (sub.eventTypes === '*') return true;
            return sub.eventTypes.includes(event.eventType);
        });

        // Process handlers sequentially to maintain order
        for (const sub of matchingSubscriptions) {
            try {
                await sub.handler(event);
            } catch (error) {
                console.error(`[EventBus] Error in handler for ${event.eventType}:`, error);
            }
        }
    }

    /**
     * Get event history (useful for debugging/replay)
     */
    getEventLog(): readonly SignalEvent[] {
        return this.eventLog;
    }

    /**
     * Clear event log (for testing)
     */
    clearLog(): void {
        this.eventLog = [];
    }

    /**
     * Get subscription count (for diagnostics)
     */
    getSubscriptionCount(): number {
        return this.subscriptions.length;
    }
}

// Singleton instance for the application
let globalEventBus: EventBus | null = null;

export function getEventBus(): EventBus {
    if (!globalEventBus) {
        globalEventBus = new EventBus();
    }
    return globalEventBus;
}

export function resetEventBus(): void {
    globalEventBus = null;
}
