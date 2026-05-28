package com.codequest.leaderboard;

import com.codequest.auth.AuthUtils;
import com.codequest.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/leaderboard")
@RequiredArgsConstructor
public class LeaderboardController {

    private final LeaderboardService leaderboardService;

    @GetMapping("/{playerId}")
    public ApiResponse<LeaderboardDto.LeaderboardResponse> getLeagueBoard(
            @PathVariable UUID playerId,
            @RequestParam(defaultValue = "20") int limit) {
        AuthUtils.requireSelfOrThrow(playerId);
        return ApiResponse.ok(leaderboardService.getLeagueBoard(playerId, limit));
    }
}
