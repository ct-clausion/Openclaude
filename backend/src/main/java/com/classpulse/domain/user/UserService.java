package com.classpulse.domain.user;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public User register(String email, String password, String name, User.Role role) {
        if (userRepository.existsByEmail(email)) {
            // Don't echo the email value into logs/exceptions (PII + account enumeration helper).
            throw new IllegalArgumentException("이미 존재하는 이메일입니다.");
        }
        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .name(name)
                .role(role)
                .build();
        return userRepository.save(user);
    }

    public User findByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }

    public User findByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }

    /**
     * 이메일 또는 username으로 사용자 조회.
     * '@' 포함 시 이메일, 아니면 username으로 검색.
     */
    public User findByIdentifier(String identifier) {
        if (identifier.contains("@")) {
            return findByEmail(identifier);
        }
        return findByUsername(identifier);
    }

    public User findById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + id));
    }

    public List<User> findByRole(User.Role role) {
        return userRepository.findByRole(role);
    }

    public boolean checkPassword(User user, String rawPassword) {
        return passwordEncoder.matches(rawPassword, user.getPasswordHash());
    }

    /** Burns roughly the same CPU as a real password verification — no real user is
     *  involved. Used by the login endpoint when the user lookup fails, to keep the
     *  response time flat for both "no such user" and "wrong password" paths. */
    public boolean matchesDummy(String rawPassword, String dummyHash) {
        try {
            return passwordEncoder.matches(rawPassword == null ? "" : rawPassword, dummyHash);
        } catch (Exception e) {
            return false;
        }
    }

    @Transactional
    public void updatePassword(User user, String newRawPassword) {
        user.setPasswordHash(passwordEncoder.encode(newRawPassword));
        userRepository.save(user);
    }
}
