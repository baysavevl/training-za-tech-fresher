package com.zalo.training.conversation.multica;

import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

@Component
public class MulticaCommandLog {

    private static final int MAX_ENTRIES = 20;

    private final ArrayDeque<MulticaCommandResult> entries = new ArrayDeque<>();

    public synchronized void record(MulticaCommandResult result) {
        entries.addFirst(result);
        while (entries.size() > MAX_ENTRIES) {
            entries.removeLast();
        }
    }

    public synchronized List<MulticaCommandResult> recent() {
        return List.copyOf(new ArrayList<>(entries));
    }
}
