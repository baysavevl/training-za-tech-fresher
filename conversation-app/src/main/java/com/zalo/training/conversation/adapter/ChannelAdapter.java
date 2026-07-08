package com.zalo.training.conversation.adapter;

import com.zalo.training.conversation.mockchat.InboundChatMessage;

/**
 * Converts a channel-specific request into the normalized message model consumed by
 * the automation engine.
 *
 * <p>The engine should not know whether the input came from Mock Chat, Zalo,
 * Web Chat, or another channel. New channels only need another adapter
 * implementation that maps their payload and correlation metadata into
 * {@link InboundChatMessage}.</p>
 */
public interface ChannelAdapter<T> {

    InboundChatMessage toInbound(T request, String requestId);
}
