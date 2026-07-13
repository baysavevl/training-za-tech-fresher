package com.zalo.training.conversation.api;

import com.zalo.training.conversation.multica.MulticaCommandResult;
import com.zalo.training.conversation.multica.MulticaCommandService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/multica")
public class MulticaController {

    private final MulticaCommandService multicaCommandService;

    public MulticaController(MulticaCommandService multicaCommandService) {
        this.multicaCommandService = multicaCommandService;
    }

    @GetMapping("/status")
    public MulticaCommandResult status() {
        return multicaCommandService.status();
    }

    @GetMapping("/runtimes")
    public MulticaCommandResult runtimes() {
        return multicaCommandService.runtimes();
    }

    @GetMapping("/agents")
    public MulticaCommandResult agents() {
        return multicaCommandService.agents();
    }

    @PostMapping("/agents")
    public MulticaCommandResult createAgent(@RequestBody MulticaCommandService.CreateAgentInput request) {
        return multicaCommandService.createAgent(request);
    }

    @GetMapping("/projects")
    public MulticaCommandResult projects() {
        return multicaCommandService.projects();
    }

    @PostMapping("/projects")
    public MulticaCommandResult createProject(@RequestBody MulticaCommandService.CreateProjectInput request) {
        return multicaCommandService.createProject(request);
    }

    @GetMapping("/repos")
    public MulticaCommandResult repos() {
        return multicaCommandService.repos();
    }

    @PostMapping("/repos")
    public MulticaCommandResult addRepo(@RequestBody MulticaCommandService.AddRepoInput request) {
        return multicaCommandService.addRepo(request);
    }

    @GetMapping("/issues")
    public MulticaCommandResult issues() {
        return multicaCommandService.issues();
    }

    @PostMapping("/issues")
    public MulticaCommandResult createIssue(@RequestBody MulticaCommandService.CreateIssueInput request) {
        return multicaCommandService.createIssue(request);
    }

    @PostMapping("/issues/{id}/assign")
    public MulticaCommandResult assignIssue(
            @PathVariable("id") String issueId,
            @RequestBody MulticaCommandService.AssignIssueInput request
    ) {
        return multicaCommandService.assignIssue(issueId, request);
    }

    @PostMapping("/daemon/restart")
    public MulticaCommandResult restartDaemon() {
        return multicaCommandService.restartDaemon();
    }

    @GetMapping("/commands")
    public List<MulticaCommandResult> commands() {
        return multicaCommandService.commands();
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, Object> invalidRequest(IllegalArgumentException exception) {
        return Map.of(
                "ok", false,
                "message", exception.getMessage()
        );
    }
}
