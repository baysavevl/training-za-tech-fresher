package com.zalo.training.conversation.automation;

public interface MessageEventPublisher {

    void publish(MessageReceivedEvent event);
}
