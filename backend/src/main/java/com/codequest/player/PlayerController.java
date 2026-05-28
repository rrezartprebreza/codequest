package com.codequest.player;

import com.codequest.auth.AuthUtils;
import com.codequest.auth.RateLimiter;
import com.codequest.auth.RefreshTokenService;
import com.codequest.common.dto.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/players")
@RequiredArgsConstructor
public class PlayerController {

    private final PlayerService playerService;
    private final RefreshTokenService refreshTokenService;
    private final RateLimiter rateLimiter;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PlayerDto.AuthResponse> register(
            @Valid @RequestBody PlayerDto.RegisterRequest request,
            HttpServletRequest httpRequest) {
        // Rate limit by client IP — no identifier exists yet.
        rateLimiter.hit("register", clientIp(httpRequest));
        Player player = playerService.register(request);
        RefreshTokenService.TokenPair pair = refreshTokenService.mintPair(player.getId(), player.getUsername());
        return ApiResponse.ok(PlayerDto.AuthResponse.of(
                player, pair.accessToken(), pair.refreshToken(), pair.accessExpiresAtEpochMs()));
    }

    @PostMapping("/login")
    public ApiResponse<PlayerDto.AuthResponse> login(
            @Valid @RequestBody PlayerDto.LoginRequest request) {
        // Rate limit by identifier so credential-stuffing one user doesn't lock others.
        rateLimiter.hit("login", request.identifier());
        Player player = playerService.login(request.identifier(), request.password());
        // Clear the limiter on success — legitimate users aren't punished for typos.
        rateLimiter.reset("login", request.identifier());
        RefreshTokenService.TokenPair pair = refreshTokenService.mintPair(player.getId(), player.getUsername());
        return ApiResponse.ok(PlayerDto.AuthResponse.of(
                player, pair.accessToken(), pair.refreshToken(), pair.accessExpiresAtEpochMs()));
    }

    /**
     * Set or reset password for the authenticated user. The legacy passwordless-
     * login path uses this immediately after first login to upgrade the account.
     * (For first-time password reset we trust the bearer token; for change-password
     * a current-password check should be added — flagged as follow-up.)
     */
    @PostMapping("/me/set-password")
    public ApiResponse<PlayerDto.PlayerResponse> setMyPassword(
            @Valid @RequestBody PlayerDto.SetPasswordRequest request) {
        UUID me = AuthUtils.requireCurrentPlayerId();
        rateLimiter.hit("set-password", me.toString());
        Player updated = playerService.setPassword(me, request.newPassword());
        return ApiResponse.ok(PlayerDto.PlayerResponse.from(updated));
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    @GetMapping("/{id}")
    public ApiResponse<PlayerDto.PlayerResponse> getById(@PathVariable UUID id) {
        AuthUtils.requireSelfOrThrow(id);
        return ApiResponse.ok(PlayerDto.PlayerResponse.from(playerService.findById(id)));
    }

    @GetMapping("/username/{username}")
    public ApiResponse<PlayerDto.PlayerResponse> getByUsername(@PathVariable String username) {
        Player player = playerService.findByUsername(username);
        AuthUtils.requireSelfOrThrow(player.getId());
        return ApiResponse.ok(PlayerDto.PlayerResponse.from(player));
    }

    @PatchMapping("/{id}/preferences")
    public ApiResponse<PlayerDto.PlayerResponse> updatePreferences(
            @PathVariable UUID id,
            @RequestBody PlayerDto.UpdatePreferencesRequest request) {
        AuthUtils.requireSelfOrThrow(id);
        Player updated = playerService.updatePreferences(id, request);
        return ApiResponse.ok(PlayerDto.PlayerResponse.from(updated));
    }

    @GetMapping("/me/privacy")
    public ApiResponse<PlayerDto.PrivacyResponse> getMyPrivacy() {
        UUID me = AuthUtils.requireCurrentPlayerId();
        return ApiResponse.ok(PlayerDto.PrivacyResponse.from(playerService.findById(me)));
    }

    @PatchMapping("/me/privacy")
    public ApiResponse<PlayerDto.PrivacyResponse> updateMyPrivacy(
            @Valid @RequestBody PlayerDto.UpdatePrivacyRequest request) {
        UUID me = AuthUtils.requireCurrentPlayerId();
        Player updated = playerService.updatePrivacy(me, request);
        return ApiResponse.ok(PlayerDto.PrivacyResponse.from(updated));
    }
}
