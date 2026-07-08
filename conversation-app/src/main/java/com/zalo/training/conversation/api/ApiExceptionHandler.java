package com.zalo.training.conversation.api;

import com.zalo.training.conversation.application.ResourceNotFoundException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse notFound(ResourceNotFoundException exception) {
        return ErrorResponse.of("NOT_FOUND", exception.getMessage());
    }

    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentNotValidException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse badRequest(Exception exception) {
        return ErrorResponse.of("BAD_REQUEST", exception.getMessage());
    }

    @ExceptionHandler(DuplicateKeyException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse conflict(DuplicateKeyException exception) {
        return ErrorResponse.of("CONFLICT", exception.getMostSpecificCause().getMessage());
    }

    public record ErrorResponse(String code, String message, Instant timestamp) {
        static ErrorResponse of(String code, String message) {
            return new ErrorResponse(code, message, Instant.now());
        }
    }
}
