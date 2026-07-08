package com.zalo.training.conversation.mockchat;

import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

@Component
public class ConversationLockManager {

    private final ConcurrentHashMap<UUID, ReentrantLock> locks = new ConcurrentHashMap<>();

    /**
     * Runs an operation with a per-conversation JVM lock.
     *
     * <p>This keeps two near-simultaneous messages for the same conversation from
     * updating the same session state concurrently. It is intentionally simple for
     * the training project. A production multi-instance deployment would move this
     * guarantee to the database, a distributed lock, or an optimistic locking
     * retry loop.</p>
     */
    public <T> T withConversationLock(UUID conversationId, LockedOperation<T> operation) {
        ReentrantLock lock = locks.computeIfAbsent(conversationId, ignored -> new ReentrantLock());
        lock.lock();
        try {
            return operation.run();
        } finally {
            lock.unlock();
        }
    }

    @FunctionalInterface
    public interface LockedOperation<T> {
        T run();
    }
}
