package com.classpulse.api.dto;

import com.classpulse.domain.user.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {}

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 1, max = 200) String password
    ) {}

    public record RegisterRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 200) String password,
            @NotBlank @Size(min = 1, max = 50) String name,
            @NotBlank String role,
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
