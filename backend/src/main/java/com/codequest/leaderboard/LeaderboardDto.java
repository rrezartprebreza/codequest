package com.codequest.leaderboard;

import java.util.List;
import java.util.UUID;

public class LeaderboardDto {

    public record LeaderboardEntry(
            int rank,
            UUID playerId,
            String username,
            int totalXp,
            int currentStreak,
            League league,
            boolean currentPlayer
    ) {}

    public record LeaderboardResponse(
            League league,
            List<LeaderboardEntry> entries
    ) {}
}
