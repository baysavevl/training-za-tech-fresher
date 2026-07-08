package com.zalo.training.conversation.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UiForwardController.class)
class UiForwardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void forwardsRootToReactIndex() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));
    }

    @Test
    void forwardsUiRoutesToReactIndex() throws Exception {
        mockMvc.perform(get("/ui/conversations/demo"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));
    }
}
