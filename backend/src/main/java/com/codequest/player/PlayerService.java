package com.codequest.player;

import com.codequest.common.exception.PlayerNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PlayerService {

    private final PlayerRepository playerRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public Player register(PlayerDto.RegisterRequest request) {
        if (playerRepository.existsByUsername(request.username())) {
            throw new IllegalArgumentException("Username already taken: " + request.username());
        }
        if (playerRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Email already registered: " + request.email());
        }
        Player player = Player.register(
                request.username(), request.email(),
                passwordEncoder.encode(request.password()),
                request.programmingLanguage(), request.level()
        );
        return playerRepository.save(player);
    }

    /**
     * Logs a player in by username/email + password.
     * Legacy accounts (created before V10) have no password yet — they're allowed
     * to log in passwordlessly so the client can force a set-password step.
     * Once a password is set, it's required.
     */
    @Transactional(readOnly = true)
    public Player login(String identifier, String password) {
        String normalized = identifier == null ? "" : identifier.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Identifier is required");
        }

        Player player = playerRepository.findByUsernameIgnoreCase(normalized)
                .or(() -> playerRepository.findByEmailIgnoreCase(normalized))
                .orElseThrow(() -> new PlayerNotFoundException(normalized));

        if (player.hasPassword()) {
            if (password == null || password.isBlank()) {
                throw new AccessDeniedException("Password required.");
            }
            if (!passwordEncoder.matches(password, player.getPasswordHash())) {
                throw new AccessDeniedException("Invalid credentials.");
            }
        }
        // else: legacy account — client must call /me/set-password right after.
        return player;
    }

    @Transactional
    public Player setPassword(UUID playerId, String newPassword) {
        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters.");
        }
        Player player = findById(playerId);
        player.setPasswordHash(passwordEncoder.encode(newPassword));
        return playerRepository.save(player);
    }

    @Transactional(readOnly = true)
    public Player findById(UUID id) {
        return playerRepository.findById(id)
                .orElseThrow(() -> new PlayerNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public Player findByUsername(String username) {
        return playerRepository.findByUsername(username)
                .orElseThrow(() -> new PlayerNotFoundException(username));
    }

    @Transactional
    public Player updatePreferences(UUID id, PlayerDto.UpdatePreferencesRequest request) {
        Player player = findById(id);
        if (request.programmingLanguage() != null) {
            player.updateProgrammingLanguage(request.programmingLanguage());
        }
        if (request.level() != null) {
            player.updateLevel(request.level());
        }
        return playerRepository.save(player);
    }

    @Transactional
    public Player updatePrivacy(UUID id, PlayerDto.UpdatePrivacyRequest request) {
        Player player = findById(id);
        player.setTutorMessagesOptIn(Boolean.TRUE.equals(request.tutorMessagesOptIn()));
        return playerRepository.save(player);
    }

    @Transactional
    public Player awardXp(UUID id, int xp) {
        Player player = findById(id);
        player.awardXp(xp);
        player.updateStreak();
        return playerRepository.save(player);
    }
}
