package com.zalo.training.conversation.api;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.InetAddress;

@Component
public class MulticaLocalRequestGuard extends OncePerRequestFilter {

    public static final String HEADER_NAME = "X-Multica-Control";
    public static final String HEADER_VALUE = "local-ui";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/multica/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            response.setStatus(HttpServletResponse.SC_NO_CONTENT);
            return;
        }

        if (!isLoopback(request.getRemoteAddr())) {
            reject(response, "Multica control center only accepts local requests");
            return;
        }

        if (!HEADER_VALUE.equals(request.getHeader(HEADER_NAME))) {
            reject(response, "Multica control center request header is required");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isLoopback(String remoteAddress) {
        if (remoteAddress == null || remoteAddress.isBlank()) {
            return false;
        }
        try {
            return InetAddress.getByName(remoteAddress).isLoopbackAddress();
        } catch (Exception exception) {
            return false;
        }
    }

    private void reject(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write("{\"ok\":false,\"message\":\"" + message + "\"}");
    }
}
