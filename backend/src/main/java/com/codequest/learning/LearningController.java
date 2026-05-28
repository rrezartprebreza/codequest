package com.codequest.learning;

import com.codequest.auth.AuthUtils;
import com.codequest.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/learning")
@RequiredArgsConstructor
public class LearningController {

    private final LearningService learningService;

    @GetMapping("/{playerId}")
    public ApiResponse<LearningDto.LearningStateResponse> getState(@PathVariable UUID playerId) {
        AuthUtils.requireSelfOrThrow(playerId);
        return ApiResponse.ok(learningService.getState(playerId));
    }
}
