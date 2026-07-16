package com.zalo.training.conversation.mockchat;

import com.zalo.training.conversation.adapter.ChannelAdapter;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class MockChatChannelAdapter implements ChannelAdapter<MockChatController.MockIncomingMessageRequest> {

    @Override
    public InboundChatMessage toInbound(MockChatController.MockIncomingMessageRequest request, String requestId) {
        return new InboundChatMessage(
                request.userId(),
                request.conversationId(),
                request.messageId(),
                request.accountId(),
                request.automationId(),
                request.text(),
                requestId
        );
    }
}
