package com.codequest.auth;

import com.codequest.common.dto.ApiResponse;
import com.codequest.player.Player;
import com.codequest.player.PlayerDto;
import com.codequest.player.PlayerService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final RefreshTokenService refreshTokenService;
    private final PlayerService playerService;

    /** Exchange a refresh token for a new (access, refresh) pair. */
    @PostMapping("/refresh")
    public ApiResponse<PlayerDto.AuthResponse> refresh(
            @Valid @RequestBody RefreshRequest request) {
        // We don't know the username from the refresh token alone, so we look
        // up the player via the token's playerId after rotation. The rotate()
        // call doesn't need username for security, only for the JWT claim.
        // Cheapest path: peek the player by hashing the token to find the row,
        // then rotate. We keep that inside the service via a single load.
        String rawRefreshToken = request.refreshToken();
        // Look up the player via the token to populate the username claim.
        UUID playerId = refreshTokenService
                .peekPlayerId(rawRefreshToken)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Unknown refresh token."));
        Player player = playerService.findById(playerId);
        RefreshTokenService.TokenPair pair = refreshTokenService.rotate(rawRefreshToken, player.getUsername());
        return ApiResponse.ok(PlayerDto.AuthResponse.of(
                player, pair.accessToken(), pair.refreshToken(), pair.accessExpiresAtEpochMs()));
    }

    /** Revoke the refresh-token family (i.e. log out everywhere on this chain). */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(@Valid @RequestBody RefreshRequest request) {
        refreshTokenService.logout(request.refreshToken());
        return ApiResponse.ok(null);
    }

    public record RefreshRequest(@NotBlank String refreshToken) {}
}
