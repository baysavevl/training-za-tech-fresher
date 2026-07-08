package com.zalo.training.intent;

import io.grpc.Server;
import io.grpc.ServerBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

@Component
@ConditionalOnProperty(name = "intent.grpc.server-enabled", havingValue = "true")
public class IntentGrpcServerLifecycle implements SmartLifecycle {

    private final IntentClassifierGrpcService grpcService;
    private final int port;
    private Server server;
    private boolean running;

    public IntentGrpcServerLifecycle(
            IntentClassifierGrpcService grpcService,
            @Value("${intent.grpc.port:9091}") int port
    ) {
        this.grpcService = grpcService;
        this.port = port;
    }

    @Override
    public void start() {
        try {
            server = ServerBuilder.forPort(port)
                    .addService(grpcService)
                    .build()
                    .start();
            running = true;
        } catch (IOException e) {
            throw new IllegalStateException("failed to start intent gRPC server on port " + port, e);
        }
    }

    @Override
    public void stop() {
        if (server == null) {
            running = false;
            return;
        }
        try {
            server.shutdown().awaitTermination(3, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            server.shutdownNow();
        } finally {
            running = false;
        }
    }

    @Override
    public boolean isRunning() {
        return running;
    }
}
