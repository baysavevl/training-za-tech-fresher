package com.zalo.training.intent;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "intent.grpc.server-enabled=false")
class IntentServiceContextTest {

    @Test
    void startsIntentServiceContext() {
    }
}
