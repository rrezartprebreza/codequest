package com.codequest.challenge;

import com.codequest.engagement.EngagementDto;
import com.codequest.player.PlayerLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class ChallengeDto {

    public record GenerateRequest(
            @NotBlank String programmingLanguage,
            @NotNull PlayerLevel difficulty,
            String topic,
            PracticeMode practiceMode
    ) {}

    public record ChallengeResponse(
            UUID id,
            String topic,
            PlayerLevel difficulty,
            String programmingLanguage,
            PracticeMode practiceMode,
            String buggyCode,
            String hint,
            int xpReward,
            String missionBrief,
            String successCriteria,
            String reflectionPrompt,
            // correctCode is only revealed for WORKED_EXAMPLE (the study mode);
            // hidden for all other modes so students cannot peek at the solution.
            String correctCode,
            String bugExplanation
    ) {
        public static ChallengeResponse from(Challenge c, String hint) {
            boolean revealSolution = c.getPracticeMode() == PracticeMode.WORKED_EXAMPLE;
            return new ChallengeResponse(
                    c.getId(), c.getTopic(), c.getDifficulty(),
                    c.getProgrammingLanguage(), c.getPracticeMode(),
                    c.getBuggyCode(), hint, c.getXpReward(),
                    c.getMissionBrief(), c.getSuccessCriteria(), c.getReflectionPrompt(),
                    revealSolution ? c.getCorrectCode() : null,
                    revealSolution ? c.getBugExplanation() : null
            );
        }
    }

    public record StudyCompleteRequest(
            @NotNull UUID playerId,
            @NotNull UUID challengeId,
            String reflectionNote
    ) {}

    public record StudyCompleteResponse(
            int xpEarned,
            int streakBonusXp,
            int dailyGoalBonusXp,
            EngagementDto.EngagementResponse engagement
    ) {}

    public record SubmitSolutionRequest(
            @NotNull UUID playerId,
            @NotNull UUID challengeId,
            @NotBlank String studentSolution,
            @NotBlank String humanLanguage,
            Integer hintLevel,
            Integer attemptsOnChallenge,
            List<String> helpUsed,
            Integer durationSec
    ) {}

    public record EvaluationResponse(
            String verdict,         // CORRECT | PARTIAL | WRONG
            String feedback,
            int xpEarned,
            String encouragement,
            String correctCode,     // revealed only when CORRECT
            int streakBonusXp,
            int dailyGoalBonusXp,
            EngagementDto.EngagementResponse engagement,
            String misconception    // null when no clear misconception
    ) {}

    public record PlayerChallengeResponse(
            UUID id,
            UUID challengeId,
            String topic,
            PlayerChallenge.AttemptStatus status,
            int hintsUsed,
            Integer xpEarned,
            Instant startedAt,
            Instant completedAt
    ) {}
}
