package com.codequest.session;

import com.codequest.auth.AuthUtils;
import com.codequest.challenge.PracticeMode;
import com.codequest.common.dto.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    /**
     * Called when a new challenge is loaded — links challenge context to tutor session.
     * Binds the session to the authenticated player so the tutor endpoint can
     * verify ownership and tutor messages are persisted under the correct user.
     */
    @PostMapping("/{sessionId}/challenge")
    public ApiResponse<Void> setChallenge(
            @PathVariable String sessionId,
            @Valid @RequestBody SetChallengeRequest request) {
        UUID me = AuthUtils.requireCurrentPlayerId();

        GameSession session = sessionService.getOrCreate(sessionId);
        // If the session is already bound to a different player, reject — prevents
        // an authenticated user from hijacking another user's session by guessing the id.
        if (session.getPlayerId() != null && !session.getPlayerId().equals(me)) {
            throw new AccessDeniedException("Session belongs to another user.");
        }
        session.setPlayerId(me);
        session.setCurrentChallenge(
                request.challengeId(),
                request.buggyCode(),
                request.practiceMode(),
                request.missionBrief(),
                request.successCriteria(),
                request.reflectionPrompt()
        );
        session.setProgrammingLanguage(request.programmingLanguage());
        session.setPlayerLevel(request.playerLevel());
        session.setHumanLanguage(request.humanLanguage());
        sessionService.save(session);
        return ApiResponse.ok(null);
    }

    public record SetChallengeRequest(
            @NotNull UUID challengeId,
            @NotNull String buggyCode,
            @NotNull String programmingLanguage,
            @NotNull PracticeMode practiceMode,
            String missionBrief,
            String successCriteria,
            String reflectionPrompt,
            @NotNull String playerLevel,
            @NotNull String humanLanguage
    ) {}
}
