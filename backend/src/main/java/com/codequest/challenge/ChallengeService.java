package com.codequest.challenge;

import com.codequest.engagement.EngagementDto;
import com.codequest.engagement.EngagementService;
import com.codequest.learning.LearningService;
import com.codequest.player.Player;
import com.codequest.player.PlayerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChallengeService {

    private final ChallengeRepository challengeRepository;
    private final PlayerChallengeRepository playerChallengeRepository;
    private final ChallengeGenerator challengeGenerator;
    private final SolutionEvaluator solutionEvaluator;
    private final PlayerService playerService;
    private final EngagementService engagementService;
    private final LearningService learningService;

    @Value("${codequest.xp.hint-penalty:20}")
    private int hintPenalty;

    @Transactional
    public ChallengeDto.ChallengeResponse generateChallenge(
            UUID playerId, ChallengeDto.GenerateRequest request) {

        playerService.findById(playerId);
        engagementService.assertCanStartChallenge(playerId);
        PracticeMode practiceMode = request.practiceMode() != null
                ? request.practiceMode()
                : learningService.recommendPracticeMode(playerId, request.topic());

        // Topic-aware cache lookup: prefer a cached challenge whose topic matches
        // the focus hint (so a "loops" request doesn't return a cached "arrays" challenge).
        // Falls back to any topic, then to LLM generation.
        var existing = (request.topic() != null && !request.topic().isBlank())
                ? challengeRepository.findRandomForPlayerByTopic(
                        playerId, request.difficulty().name(), request.programmingLanguage(),
                        practiceMode.name(), request.topic().trim())
                  .or(() -> challengeRepository.findRandomForPlayer(
                        playerId, request.difficulty().name(), request.programmingLanguage(), practiceMode.name()))
                : challengeRepository.findRandomForPlayer(
                        playerId, request.difficulty().name(), request.programmingLanguage(), practiceMode.name());

        Challenge challenge;
        String hint;

        if (existing.isPresent()) {
            challenge = existing.get();
            hint = "Think carefully about what this code is trying to do.";
            log.debug("Reusing cached challenge {} for player {}", challenge.getId(), playerId);
        } else {
            // Generate a fresh one from AI
            ChallengeGenerator.GeneratedChallenge generated = challengeGenerator.generate(
                    request.programmingLanguage(), request.difficulty(), request.topic(), practiceMode);

            challenge = Challenge.create(
                    request.topic() != null ? request.topic() : "General",
                    request.difficulty(),
                    request.programmingLanguage(),
                    practiceMode,
                    generated.buggyCode(),
                    generated.correctCode(),
                    generated.bugExplanation(),
                    fallback(generated.missionBrief(), defaultMissionBrief(practiceMode, request.programmingLanguage(), request.topic())),
                    fallback(generated.successCriteria(), defaultSuccessCriteria(practiceMode)),
                    fallback(generated.reflectionPrompt(), defaultReflectionPrompt(practiceMode)),
                    calculateXpReward(request.difficulty())
            );
            challenge = challengeRepository.save(challenge);
            hint = generated.hint();
            log.info("Generated new challenge {} for player {}", challenge.getId(), playerId);
        }

        // Start attempt tracking
        PlayerChallenge attempt = PlayerChallenge.start(playerId, challenge.getId());
        playerChallengeRepository.save(attempt);

        return ChallengeDto.ChallengeResponse.from(challenge, hint);
    }

    @Transactional
    public ChallengeDto.EvaluationResponse submitSolution(ChallengeDto.SubmitSolutionRequest request) {
        Challenge challenge = challengeRepository.findById(request.challengeId())
                .orElseThrow(() -> new IllegalArgumentException("Challenge not found"));

        Player player = playerService.findById(request.playerId());
        engagementService.assertCanStartChallenge(request.playerId());

        PlayerChallenge attempt = playerChallengeRepository
                .findFirstByPlayerIdAndChallengeIdAndStatusOrderByStartedAtDesc(
                        request.playerId(), request.challengeId(),
                        PlayerChallenge.AttemptStatus.IN_PROGRESS)
                .orElseGet(() -> PlayerChallenge.start(request.playerId(), request.challengeId()));

        int maxXp = challenge.getXpReward() - (attempt.getHintsUsed() * hintPenalty);
        maxXp = Math.max(maxXp, 10); // always award at least 10 XP

        SolutionEvaluator.EvaluationResult result = solutionEvaluator.evaluate(
                challenge.getBuggyCode(), challenge.getCorrectCode(),
                request.studentSolution(), player.getLevel(),
                player.getProgrammingLanguage(), request.humanLanguage(),
                attempt.getHintsUsed(), maxXp
        );

        int timeSpent = (int) (Instant.now().getEpochSecond() - attempt.getStartedAt().getEpochSecond());

        int streakBonusXp = 0;
        int dailyGoalBonusXp = 0;
        EngagementDto.EngagementResponse engagement = engagementService.getSnapshot(request.playerId());

        if (result.isCorrect()) {
            attempt.complete(request.studentSolution(), result.feedback(), result.xpEarned(), timeSpent, result.misconception());
            EngagementService.RewardResult rewardResult = engagementService.applyCorrectSubmission(
                    request.playerId(), result.xpEarned());
            streakBonusXp = rewardResult.streakBonusXp();
            dailyGoalBonusXp = rewardResult.dailyGoalBonusXp();
            engagement = rewardResult.engagement();
        } else if (result.isPartial()) {
            attempt.incrementHints();
        } else {
            attempt.fail(request.studentSolution(), result.feedback(), result.misconception());
            engagement = engagementService.applyWrongSubmission(request.playerId());
        }

        playerChallengeRepository.save(attempt);
        learningService.recordAttempt(
                request.playerId(),
                challenge,
                result.verdict(),
                request.hintLevel() == null ? attempt.getHintsUsed() : request.hintLevel(),
                request.attemptsOnChallenge() == null ? 1 : request.attemptsOnChallenge(),
                request.helpUsed(),
                request.studentSolution().trim().length(),
                request.durationSec() == null ? Math.max(1, timeSpent) : request.durationSec(),
                challenge.getPracticeMode(),
                result.misconception()
        );

        return new ChallengeDto.EvaluationResponse(
                result.verdict(),
                result.feedback(),
                result.xpEarned() + streakBonusXp + dailyGoalBonusXp,
                result.encouragement(),
                result.isCorrect() ? challenge.getCorrectCode() : null,
                streakBonusXp,
                dailyGoalBonusXp,
                engagement,
                result.misconception()
        );
    }

    /**
     * Marks a WORKED_EXAMPLE challenge as studied. Students study, they don't submit code,
     * so we bypass the LLM evaluator entirely. Awards half XP (studying is lower-cost
     * effort than fresh problem-solving), still feeds streaks / daily goals so the
     * activity counts toward progress.
     */
    @Transactional
    public ChallengeDto.StudyCompleteResponse markStudyComplete(ChallengeDto.StudyCompleteRequest request) {
        Challenge challenge = challengeRepository.findById(request.challengeId())
                .orElseThrow(() -> new IllegalArgumentException("Challenge not found"));

        if (challenge.getPracticeMode() != PracticeMode.WORKED_EXAMPLE) {
            throw new IllegalArgumentException("Study-complete is only valid for WORKED_EXAMPLE challenges");
        }

        playerService.findById(request.playerId());
        engagementService.assertCanStartChallenge(request.playerId());

        PlayerChallenge attempt = playerChallengeRepository
                .findFirstByPlayerIdAndChallengeIdAndStatusOrderByStartedAtDesc(
                        request.playerId(), request.challengeId(),
                        PlayerChallenge.AttemptStatus.IN_PROGRESS)
                .orElseGet(() -> PlayerChallenge.start(request.playerId(), request.challengeId()));

        int timeSpent = (int) (Instant.now().getEpochSecond() - attempt.getStartedAt().getEpochSecond());
        int xp = Math.max(10, challenge.getXpReward() / 2);
        String note = request.reflectionNote() == null || request.reflectionNote().isBlank()
                ? "Studied worked example."
                : "Studied worked example. Reflection: " + request.reflectionNote().trim();

        attempt.complete(note, note, xp, Math.max(1, timeSpent), null);
        playerChallengeRepository.save(attempt);

        EngagementService.RewardResult reward = engagementService.applyCorrectSubmission(request.playerId(), xp);

        learningService.recordAttempt(
                request.playerId(),
                challenge,
                "CORRECT",
                0,
                1,
                java.util.List.of("worked-example"),
                note.length(),
                Math.max(1, timeSpent),
                PracticeMode.WORKED_EXAMPLE,
                null
        );

        return new ChallengeDto.StudyCompleteResponse(
                xp + reward.streakBonusXp() + reward.dailyGoalBonusXp(),
                reward.streakBonusXp(),
                reward.dailyGoalBonusXp(),
                reward.engagement()
        );
    }

    @Transactional(readOnly = true)
    public Page<ChallengeDto.PlayerChallengeResponse> getHistory(UUID playerId, Pageable pageable) {
        return playerChallengeRepository
                .findByPlayerIdOrderByStartedAtDesc(playerId, pageable)
                .map(pc -> {
                    Challenge c = challengeRepository.findById(pc.getChallengeId()).orElseThrow();
                    return new ChallengeDto.PlayerChallengeResponse(
                            pc.getId(), pc.getChallengeId(), c.getTopic(),
                            pc.getStatus(), pc.getHintsUsed(), pc.getXpEarned(),
                            pc.getStartedAt(), pc.getCompletedAt()
                    );
                });
    }

    private int calculateXpReward(com.codequest.player.PlayerLevel difficulty) {
        return switch (difficulty) {
            case BEGINNER -> 100;
            case INTERMEDIATE -> 200;
            case SENIOR -> 350;
            case MASTER -> 500;
        };
    }

    private String fallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String defaultMissionBrief(PracticeMode practiceMode, String language, String topic) {
        String resolvedTopic = topic == null || topic.isBlank() ? "core debugging" : topic.trim();
        return switch (practiceMode) {
            case TEST_FIRST -> "Read the behavior clues first, then fix the " + language + " code so it satisfies the expected outcomes for " + resolvedTopic + ".";
            case OUTPUT_TRACING -> "Trace the code step by step in " + language + " and identify the exact point where " + resolvedTopic + " goes wrong.";
            case EDGE_CASE_RESCUE -> "Harden the " + language + " solution for " + resolvedTopic + " by fixing the edge case that breaks real usage.";
            case BUG_HUNT -> "Find the smallest logic bug in this " + language + " snippet and repair it cleanly for " + resolvedTopic + ".";
            case WORKED_EXAMPLE -> "Study this solved " + resolvedTopic + " example in " + language + ". Compare the buggy and fixed versions, then write down the rule in your own words.";
        };
    }

    private String defaultSuccessCriteria(PracticeMode practiceMode) {
        return switch (practiceMode) {
            case TEST_FIRST -> "Explain the expected behavior, test one normal case plus one edge case, then change only the logic needed to satisfy both.";
            case OUTPUT_TRACING -> "Write down one sample input, trace each step until the wrong value appears, and fix the precise line that causes the bad output.";
            case EDGE_CASE_RESCUE -> "Identify the failing edge case, add the missing guard or boundary handling, and confirm the normal case still works.";
            case BUG_HUNT -> "Locate the wrong condition, boundary, or return path and replace it with the smallest correct fix.";
            case WORKED_EXAMPLE -> "Read both versions slowly. Name the single rule that the fix encodes, in one sentence. Then predict what would break if the rule were ignored.";
        };
    }

    private String defaultReflectionPrompt(PracticeMode practiceMode) {
        return switch (practiceMode) {
            case TEST_FIRST -> "Which expected behavior did you use to prove the bug was fixed?";
            case OUTPUT_TRACING -> "At which exact step did actual behavior diverge from expected behavior?";
            case EDGE_CASE_RESCUE -> "Which edge case was missing from the original logic, and how will you check it next time?";
            case BUG_HUNT -> "What clue helped you find the root cause instead of guessing?";
            case WORKED_EXAMPLE -> "Restate the rule from the fix in one sentence — would you recognize this pattern in unfamiliar code?";
        };
    }
}
