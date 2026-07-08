package com.zalo.training.conversation.mockchat;

import org.junit.jupiter.api.Test;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class ConversationLockManagerTest {

    private final ConversationLockManager lockManager = new ConversationLockManager();

    @Test
    void serializesOperationsForSameConversation() throws Exception {
        UUID conversationId = UUID.randomUUID();
        int taskCount = 16;
        AtomicBoolean insideCriticalSection = new AtomicBoolean(false);
        AtomicInteger violations = new AtomicInteger(0);
        AtomicInteger processed = new AtomicInteger(0);
        CountDownLatch ready = new CountDownLatch(taskCount);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(taskCount);
        var executor = Executors.newFixedThreadPool(taskCount);

        try {
            for (int i = 0; i < taskCount; i++) {
                executor.submit(() -> {
                    ready.countDown();
                    try {
                        await(start);
                        lockManager.withConversationLock(conversationId, () -> {
                            if (!insideCriticalSection.compareAndSet(false, true)) {
                                violations.incrementAndGet();
                            }
                            sleep();
                            processed.incrementAndGet();
                            insideCriticalSection.set(false);
                            return null;
                        });
                    } finally {
                        done.countDown();
                    }
                });
            }

            assertThat(ready.await(2, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(done.await(5, TimeUnit.SECONDS)).isTrue();
        } finally {
            executor.shutdownNow();
        }

        assertThat(processed).hasValue(taskCount);
        assertThat(violations).hasValue(0);
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssertionError(e);
        }
    }

    private static void sleep() {
        try {
            TimeUnit.MILLISECONDS.sleep(2);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssertionError(e);
        }
    }
}
