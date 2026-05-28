package com.codequest.engagement;

import com.codequest.auth.AuthUtils;
import com.codequest.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/engagement")
@RequiredArgsConstructor
public class EngagementController {

    private final EngagementService engagementService;

    @GetMapping("/{playerId}")
    public ApiResponse<EngagementDto.EngagementResponse> getEngagement(@PathVariable UUID playerId) {
        AuthUtils.requireSelfOrThrow(playerId);
        return ApiResponse.ok(engagementService.getSnapshot(playerId));
    }
}

