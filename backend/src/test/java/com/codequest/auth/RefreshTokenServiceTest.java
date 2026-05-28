package com.codequest.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RefreshTokenServiceTest {

    @Mock RefreshTokenRepository repo;
    @Mock JwtService jwt;

    @InjectMocks RefreshTokenService service;

    @BeforeEach
    void config() {
        ReflectionTestUtils.setField(service, "refreshTtlSeconds", 60L);
        when(jwt.mint(any(UUID.class), anyString())).thenReturn("ACCESS-TOKEN");
        when(jwt.accessTtl()).thenReturn(Duration.ofMinutes(15));
        when(repo.save(any(RefreshToken.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void mintPair_persists_one_refresh_row_with_random_family() {
        UUID player = UUID.randomUUID();
        RefreshTokenService.TokenPair pair = service.mintPair(player, "alice");

        assertThat(pair.accessToken()).isEqualTo("ACCESS-TOKEN");
        assertThat(pair.refreshToken()).isNotBlank();
        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(repo, atLeastOnce()).save(captor.capture());
        assertThat(captor.getValue().getPlayerId()).isEqualTo(player);
        assertThat(captor.getValue().getFamilyId()).isNotNull();
    }

    @Test
    void rotate_marks_token_used_and_mints_new_pair_in_same_family() {
        UUID player  = UUID.randomUUID();
        UUID family  = UUID.randomUUID();
        String raw   = "refresh-original";
        RefreshToken stored = RefreshToken.create(player,
                RefreshTokenService.sha256Hex(raw),
                family,
                Instant.now().plus(Duration.ofMinutes(10)));
        when(repo.findByTokenHash(RefreshTokenService.sha256Hex(raw))).thenReturn(Optional.of(stored));

        RefreshTokenService.TokenPair newPair = service.rotate(raw, "alice");

        assertThat(stored.isUsed()).isTrue();
        // Two saves: 1) marking the old token used, 2) persisting the new token.
        verify(repo, times(2)).save(any(RefreshToken.class));
        assertThat(newPair.refreshToken()).isNotEqualTo(raw);
    }

    @Test
    void rotate_with_reused_token_revokes_entire_family() {
        UUID player = UUID.randomUUID();
        UUID family = UUID.randomUUID();
        String raw  = "refresh-replayed";
        RefreshToken stored = RefreshToken.create(player,
                RefreshTokenService.sha256Hex(raw),
                family,
                Instant.now().plus(Duration.ofMinutes(10)));
        stored.markUsed(); // already redeemed
        when(repo.findByTokenHash(RefreshTokenService.sha256Hex(raw))).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> service.rotate(raw, "alice"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("reuse");

        verify(repo).revokeFamily(family);
        verify(repo, never()).save(any(RefreshToken.class));
    }

    @Test
    void rotate_with_unknown_token_throws() {
        when(repo.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.rotate("ghost", "alice"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void rotate_with_revoked_token_throws_and_does_not_save() {
        UUID player = UUID.randomUUID();
        RefreshToken stored = RefreshToken.create(player,
                RefreshTokenService.sha256Hex("x"),
                UUID.randomUUID(),
                Instant.now().plus(Duration.ofMinutes(10)));
        stored.markRevoked();
        when(repo.findByTokenHash(anyString())).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> service.rotate("x", "alice"))
                .isInstanceOf(AccessDeniedException.class);
        verify(repo, never()).save(any(RefreshToken.class));
    }

    @Test
    void rotate_with_expired_token_deletes_and_throws() {
        UUID player = UUID.randomUUID();
        RefreshToken stored = RefreshToken.create(player,
                RefreshTokenService.sha256Hex("e"),
                UUID.randomUUID(),
                Instant.now().minus(Duration.ofMinutes(1)));
        when(repo.findByTokenHash(anyString())).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> service.rotate("e", "alice"))
                .isInstanceOf(AccessDeniedException.class);
        verify(repo).delete(stored);
    }

    @Test
    void logout_revokes_family() {
        UUID family = UUID.randomUUID();
        RefreshToken stored = RefreshToken.create(UUID.randomUUID(),
                RefreshTokenService.sha256Hex("a"), family,
                Instant.now().plus(Duration.ofMinutes(10)));
        when(repo.findByTokenHash(anyString())).thenReturn(Optional.of(stored));

        service.logout("a");

        verify(repo).revokeFamily(family);
    }

    @Test
    void logout_with_no_token_is_a_noop() {
        service.logout(null);
        service.logout("");
        verify(repo, never()).revokeFamily(any(UUID.class));
    }
}
