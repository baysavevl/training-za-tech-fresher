package com.zalo.training.intent;

import com.zalo.training.intent.contract.ClassifyIntentRequest;
import com.zalo.training.intent.contract.ClassifyIntentResponse;
import com.zalo.training.intent.contract.IntentClassifierGrpc;
import io.grpc.ManagedChannel;
import io.grpc.Server;
import io.grpc.inprocess.InProcessChannelBuilder;
import io.grpc.inprocess.InProcessServerBuilder;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class IntentClassifierGrpcServiceTest {

    @Test
    void classifiesIntentThroughGrpcContract() throws Exception {
        String serverName = InProcessServerBuilder.generateName();
        Server server = InProcessServerBuilder.forName(serverName)
                .directExecutor()
                .addService(new IntentClassifierGrpcService(new RuleBasedIntentClassifier()))
                .build()
                .start();
        ManagedChannel channel = InProcessChannelBuilder.forName(serverName)
                .directExecutor()
                .build();

        try {
            ClassifyIntentResponse response = IntentClassifierGrpc.newBlockingStub(channel)
                    .classifyIntent(ClassifyIntentRequest.newBuilder()
                            .setMessageId("msg-001")
                            .setConversationId("conversation-001")
                            .setContent("toi muon gap nhan vien ho tro")
                            .setTraceId("trace-001")
                            .build());

            assertThat(response.getIntent()).isEqualTo("HUMAN_AGENT_REQUEST");
            assertThat(response.getReason()).contains("human support");
        } finally {
            channel.shutdownNow();
            server.shutdownNow();
        }
    }
}
