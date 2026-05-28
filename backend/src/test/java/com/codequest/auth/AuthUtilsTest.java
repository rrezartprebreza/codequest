package com.codequest.auth;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuthUtilsTest {

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void currentPlayerId_returns_null_when_unauthenticated() {
        assertThat(AuthUtils.currentPlayerId()).isNull();
    }

    @Test
    void requireCurrentPlayerId_throws_when_unauthenticated() {
        assertThatThrownBy(AuthUtils::requireCurrentPlayerId)
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void requireCurrentPlayerId_returns_principal_uuid_when_authenticated() {
        UUID id = UUID.randomUUID();
        authenticateAs(id);

        assertThat(AuthUtils.currentPlayerId()).isEqualTo(id);
        assertThat(AuthUtils.requireCurrentPlayerId()).isEqualTo(id);
    }

    @Test
    void requireSelfOrThrow_passes_when_ids_match() {
        UUID id = UUID.randomUUID();
        authenticateAs(id);

        AuthUtils.requireSelfOrThrow(id);
    }

    @Test
    void requireSelfOrThrow_throws_when_ids_differ() {
        UUID me = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        authenticateAs(me);

        assertThatThrownBy(() -> AuthUtils.requireSelfOrThrow(other))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void requireSelfOrThrow_throws_when_unauthenticated() {
        assertThatThrownBy(() -> AuthUtils.requireSelfOrThrow(UUID.randomUUID()))
                .isInstanceOf(AccessDeniedException.class);
    }

    private void authenticateAs(UUID playerId) {
        var auth = new UsernamePasswordAuthenticationToken(playerId, "n/a", List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
