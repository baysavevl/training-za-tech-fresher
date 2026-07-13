package com.zalo.training.conversation.api;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class UiForwardController {

    @GetMapping({"/", "/ui", "/ui/**", "/training", "/training/**", "/agents", "/agents/**"})
    public String forwardToReactIndex() {
        return "forward:/index.html";
    }
}
