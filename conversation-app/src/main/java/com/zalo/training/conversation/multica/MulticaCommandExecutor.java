package com.zalo.training.conversation.multica;

import java.util.List;

public interface MulticaCommandExecutor {

    MulticaCommandResult run(MulticaCommandKind kind, List<String> command, boolean parseJson);
}
