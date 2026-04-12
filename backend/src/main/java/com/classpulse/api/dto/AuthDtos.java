package com.classpulse.api.dto;

import com.classpulse.domain.user.User;

public final class AuthDtos {

    private AuthDtos() {}

    public record LoginRequest(
            String email,
            String password
    ) {}

    public record RegisterRequest(
            String email,
            String password,
            String name,
            String role,
            String inviteCode
    ) {}

    public record AuthResponse(
            String token,
            UserDto user
    ) {}

    public record UserDto(
            Long id,
            String email,
            String name,
            String role
    ) {
        public static UserDto from(User user) {
            return new UserDto(
                    user.getId(),
                    user.getEmail(),
                    user.getName(),
                    user.getRole().name()
            );
        }
    }
}
