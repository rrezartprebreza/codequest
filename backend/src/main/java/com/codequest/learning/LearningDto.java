package com.codequest.learning;

import com.codequest.challenge.PracticeMode;
import com.codequest.player.PlayerLevel;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

public class LearningDto {

    public record LearningStateResponse(
            List<AttemptRecordResponse> attempts,
            Map<String, CategoryStatResponse> categoryStats,
            List<String> seenFingerprints,
            LearningSummaryResponse summary,
            ReviewPlanResponse reviewPlan,
            PracticeMode recommendedPracticeMode,
            List<String> weakestCategories,
            List<String> dueReviewCategories
    ) {}

    public record AttemptRecordResponse(
            UUID challengeId,
            long timestamp,
            List<String> categories,
            String bugPattern,
            String verdict,
            int hintLevel,
            int attemptsOnChallenge,
            List<String> helpUsed,
            int submissionChars,
            int durationSec,
            PlayerLevel difficulty,
            PracticeMode practiceMode,
            String fingerprint
    ) {
        static AttemptRecordResponse from(LearningAttempt attempt) {
            return new AttemptRecordResponse(
                    attempt.getChallengeId(),
                    toEpochMs(attempt.getCreatedAt()),
                    splitCsv(attempt.getCategories()),
                    attempt.getBugPattern(),
                    attempt.getVerdict(),
                    attempt.getHintLevel(),
                    attempt.getAttemptsOnChallenge(),
                    splitCsv(attempt.getHelpUsed()),
                    attempt.getSubmissionChars(),
                    attempt.getDurationSec(),
                    attempt.getDifficulty(),
                    attempt.getPracticeMode(),
                    attempt.getFingerprint()
            );
        }
    }

    public record CategoryStatResponse(
            int attempts,
            int correct,
            int partial,
            int wrong,
            double confidence,
            PracticeMode recommendedPracticeMode,
            long nextReviewAt,
            long lastSeenAt
    ) {
        static CategoryStatResponse from(LearningCategoryStat stat) {
            return new CategoryStatResponse(
                    stat.getAttempts(),
                    stat.getCorrect(),
                    stat.getPartial(),
                    stat.getWrong(),
                    stat.getConfidence(),
                    stat.getRecommendedMode(),
                    toEpochMs(stat.getNextReviewAt()),
                    toEpochMs(stat.getLastSeenAt())
            );
        }
    }

    public record LearningSummaryResponse(
            int attempts,
            int correctRate,
            int partialRate,
            int wrongRate,
            int avgDurationSec,
            double avgHintLevel,
            int dueReviews
    ) {}

    public record ReviewPlanResponse(
            List<String> categories,
            String topic,
            String reason
    ) {}

    static LearningStateResponse from(
            List<LearningAttempt> attempts,
            List<LearningCategoryStat> stats,
            LearningSummaryResponse summary,
            ReviewPlanResponse reviewPlan,
            PracticeMode recommendedPracticeMode,
            List<String> weakestCategories,
            List<String> dueReviewCategories
    ) {
        List<AttemptRecordResponse> attemptResponses = attempts.stream()
                .map(AttemptRecordResponse::from)
                .toList();
        Map<String, CategoryStatResponse> statResponses = stats.stream()
                .collect(Collectors.toMap(LearningCategoryStat::getCategory, CategoryStatResponse::from));
        List<String> fingerprints = attempts.stream()
                .map(LearningAttempt::getFingerprint)
                .distinct()
                .toList();
        return new LearningStateResponse(
                attemptResponses,
                statResponses,
                fingerprints,
                summary,
                reviewPlan,
                recommendedPracticeMode,
                weakestCategories,
                dueReviewCategories
        );
    }

    private static List<String> splitCsv(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .toList();
    }

    private static long toEpochMs(Instant instant) {
        return instant == null ? 0 : instant.toEpochMilli();
    }
}
