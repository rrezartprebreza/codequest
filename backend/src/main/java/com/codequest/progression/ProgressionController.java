package com.codequest.progression;

import com.codequest.auth.AuthUtils;
import com.codequest.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/progression")
@RequiredArgsConstructor
public class ProgressionController {

    private final ProgressionService progressionService;

    @GetMapping("/{playerId}")
    public ApiResponse<ProgressionDto.ProgressionResponse> getProgression(@PathVariable UUID playerId) {
        AuthUtils.requireSelfOrThrow(playerId);
        return ApiResponse.ok(progressionService.getProgression(playerId));
    }

    @PostMapping("/{playerId}/complete")
    public ApiResponse<ProgressionDto.ProgressionResponse> completeNode(
            @PathVariable UUID playerId,
            @Valid @RequestBody(required = false) ProgressionDto.CompleteNodeRequest request) {
        AuthUtils.requireSelfOrThrow(playerId);
        int stars = request != null && request.stars() != null ? request.stars() : 3;
        return ApiResponse.ok(progressionService.completeActiveNode(playerId, stars));
    }
}


