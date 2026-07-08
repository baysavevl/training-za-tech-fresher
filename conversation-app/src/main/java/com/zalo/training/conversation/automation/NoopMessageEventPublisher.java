package com.zalo.training.conversation.automation;

import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

@Component
@Primary
public class NoopMessageEventPublisher implements MessageEventPublisher {

    @Override
    public void publish(MessageReceivedEvent event) {
    }
}
