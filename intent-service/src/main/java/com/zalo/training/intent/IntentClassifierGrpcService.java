package com.zalo.training.intent;

import com.zalo.training.intent.contract.ClassifyIntentRequest;
import com.zalo.training.intent.contract.ClassifyIntentResponse;
import com.zalo.training.intent.contract.IntentClassifierGrpc;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Component;

@Component
public class IntentClassifierGrpcService extends IntentClassifierGrpc.IntentClassifierImplBase {

    private final RuleBasedIntentClassifier classifier;

    public IntentClassifierGrpcService(RuleBasedIntentClassifier classifier) {
        this.classifier = classifier;
    }

    @Override
    public void classifyIntent(
            ClassifyIntentRequest request,
            StreamObserver<ClassifyIntentResponse> responseObserver
    ) {
        IntentClassification classification = classifier.classify(request.getContent());
        responseObserver.onNext(ClassifyIntentResponse.newBuilder()
                .setIntent(classification.intent())
                .setConfidence(classification.confidence())
                .setReason(classification.reason())
                .build());
        responseObserver.onCompleted();
    }
}
