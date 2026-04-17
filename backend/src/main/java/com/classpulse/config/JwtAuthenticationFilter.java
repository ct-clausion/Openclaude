package com.classpulse.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtProvider jwtProvider;
    private final JwtBlocklist jwtBlocklist;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            String token = extractTokenFromRequest(request);

            if (token != null && jwtProvider.validateToken(token) && !jwtBlocklist.isRevoked(token)) {
                Long userId = jwtProvider.extractUserId(token);
                String rolesStr = jwtProvider.extractRoles(token);

                List<SimpleGrantedAuthority> authorities = Arrays.stream(rolesStr.split(","))
                        .filter(StringUtils::hasText)
                        .map(role -> new SimpleGrantedAuthority(
                                role.startsWith("ROLE_") ? role : "ROLE_" + role))
                        .collect(Collectors.toList());

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(userId, null, authorities);
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authentication);
                log.debug("Authenticated user {} with roles {}", userId, rolesStr);
            }
        } catch (Exception e) {
            log.error("Could not set user authentication in security context", e);
        }

        filterChain.doFilter(request, response);
    }

    private String extractTokenFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader(AUTHORIZATION_HEADER);
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith(BEARER_PREFIX)) {
            return bearerToken.substring(BEARER_PREFIX.length());
        }
        // SSE endpoints are the one exception where query-param tokens are allowed.
        // EventSource (the browser API) cannot attach custom headers, so
        // `?token=...` is the only viable auth for these streams. STOMP uses its
        // own CONNECT frame and does NOT fall back here.
        if (isSsePath(request.getServletPath())) {
            String tokenParam = request.getParameter("token");
            if (StringUtils.hasText(tokenParam)) {
                return tokenParam;
            }
        }
        return null;
    }

    private boolean isSsePath(String path) {
        if (path == null) return false;
        return path.equals("/api/notifications/stream")
                || (path.startsWith("/api/chatbot/conversations/") && path.endsWith("/stream"));
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = request.getServletPath();
        // Only skip JWT filter for login and register endpoints
        return path.equals("/api/auth/login") || path.equals("/api/auth/register");
    }
}
