package com.codequest.challenge;

import com.codequest.auth.AuthUtils;
import com.codequest.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/challenges")
@RequiredArgsConstructor
public class ChallengeController {

    private final ChallengeService challengeService;

    @PostMapping("/generate/{playerId}")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ChallengeDto.ChallengeResponse> generate(
            @PathVariable UUID playerId,
            @Valid @RequestBody ChallengeDto.GenerateRequest request) {
        AuthUtils.requireSelfOrThrow(playerId);
        return ApiResponse.ok(challengeService.generateChallenge(playerId, request));
    }

    @PostMapping("/submit")
    public ApiResponse<ChallengeDto.EvaluationResponse> submit(
            @Valid @RequestBody ChallengeDto.SubmitSolutionRequest request) {
        AuthUtils.requireSelfOrThrow(request.playerId());
        return ApiResponse.ok(challengeService.submitSolution(request));
    }

    /** Mark a WORKED_EXAMPLE challenge as studied (no LLM eval, half XP). */
    @PostMapping("/study-complete")
    public ApiResponse<ChallengeDto.StudyCompleteResponse> studyComplete(
            @Valid @RequestBody ChallengeDto.StudyCompleteRequest request) {
        AuthUtils.requireSelfOrThrow(request.playerId());
        return ApiResponse.ok(challengeService.markStudyComplete(request));
    }

    @GetMapping("/history/{playerId}")
    public ApiResponse<Page<ChallengeDto.PlayerChallengeResponse>> history(
            @PathVariable UUID playerId,
            @PageableDefault(size = 20, sort = "startedAt") Pageable pageable) {
        AuthUtils.requireSelfOrThrow(playerId);
        return ApiResponse.ok(challengeService.getHistory(playerId, pageable));
    }
}
