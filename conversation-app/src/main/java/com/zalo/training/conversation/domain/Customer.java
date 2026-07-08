package com.zalo.training.conversation.domain;

import java.time.Instant;
import java.util.UUID;

public record Customer(
        UUID id,
        String externalId,
        String displayName,
        Instant createdAt
) {
}
