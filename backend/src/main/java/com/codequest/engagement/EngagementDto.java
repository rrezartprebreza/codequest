package com.codequest.engagement;

public class EngagementDto {

    public record EngagementResponse(
            int heartsRemaining,
            int maxHearts,
            long minutesUntilNextHeart,
            int dailyGoalProgress,
            int dailyGoalTarget,
            boolean dailyGoalCompleted,
            int streak,
            int longestStreak,
            int streakBonusXp,
            int dailyGoalBonusXp
    ) {}
}

