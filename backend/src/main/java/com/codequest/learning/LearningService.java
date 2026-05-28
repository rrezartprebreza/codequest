package com.codequest.learning;

import com.codequest.challenge.Challenge;
import com.codequest.challenge.PracticeMode;
import com.codequest.player.PlayerLevel;
import com.codequest.player.PlayerService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LearningService {

    private static final int MAX_HELP_ITEMS = 8;

    private final LearningAttemptRepository attemptRepository;
    private final LearningCategoryStatRepository categoryStatRepository;
    private final PlayerService playerService;

    @Transactional(readOnly = true)
    public LearningDto.LearningStateResponse getState(UUID playerId) {
        playerService.findById(playerId);
        List<LearningAttempt> attempts = new ArrayList<>(attemptRepository.findTop300ByPlayerIdOrderByCreatedAtDesc(playerId));
        Collections.reverse(attempts);
        List<LearningCategoryStat> stats = categoryStatRepository.findByPlayerId(playerId);
        LearningDto.LearningSummaryResponse summary = buildSummary(attempts, stats);
        List<String> weakestCategories = weakestCategories(stats, 3);
        List<String> dueReviewCategories = dueReviewCategories(stats, 3);
        LearningDto.ReviewPlanResponse reviewPlan = buildReviewPlan(stats);
        return LearningDto.from(
                attempts,
                stats,
                summary,
                reviewPlan,
                recommendPracticeMode(stats, null),
                weakestCategories,
                dueReviewCategories
        );
    }

    @Transactional
    public void recordAttempt(
            UUID playerId,
            Challenge challenge,
            String verdict,
            int hintLevel,
            int attemptsOnChallenge,
            List<String> helpUsed,
            int submissionChars,
            int durationSec,
            PracticeMode practiceMode,
            String misconception
    ) {
        playerService.findById(playerId);
        Instant now = Instant.now();
        List<String> categories = inferCategories(challenge);
        RecordLearningAttempt command = new RecordLearningAttempt(
                playerId,
                challenge.getId(),
                categories,
                inferBugPattern(challenge),
                normalizeVerdict(verdict),
                Math.max(0, hintLevel),
                Math.max(1, attemptsOnChallenge),
                sanitizeHelpUsed(helpUsed),
                Math.max(0, submissionChars),
                Math.max(1, durationSec),
                challenge.getDifficulty(),
                practiceMode == null ? PracticeMode.BUG_HUNT : practiceMode,
                fingerprint(challenge.getBuggyCode()),
                normalizeMisconception(misconception)
        );

        attemptRepository.save(LearningAttempt.create(command));
        double attemptScore = scoreAttempt(command.verdict(), command.hintLevel(), command.durationSec());
        Instant nextReviewAt = now.plus(reviewInterval(command.verdict(), command.hintLevel(), command.attemptsOnChallenge()));

        for (String category : command.categories()) {
            LearningCategoryStat stat = categoryStatRepository.findByPlayerIdAndCategory(playerId, category)
                    .orElseGet(() -> LearningCategoryStat.create(playerId, category));
            stat.record(command.verdict(), attemptScore, now, nextReviewAt, recommendedModeForCategory(category));
            categoryStatRepository.save(stat);
        }
    }

    @Transactional(readOnly = true)
    public PracticeMode recommendPracticeMode(UUID playerId, String topic) {
        playerService.findById(playerId);
        List<LearningCategoryStat> stats = categoryStatRepository.findByPlayerId(playerId);
        return recommendPracticeMode(stats, topic);
    }

    record RecordLearningAttempt(
            UUID playerId,
            UUID challengeId,
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
            String fingerprint,
            String misconception
    ) {}

    private String normalizeMisconception(String raw) {
        if (raw == null) return null;
        String value = raw.trim().toLowerCase(Locale.ROOT);
        if (value.isEmpty() || "none".equals(value) || value.length() > 80) return null;
        return value;
    }

    private List<String> inferCategories(Challenge challenge) {
        String text = (challenge.getTopic() + " " + challenge.getBuggyCode()).toLowerCase(Locale.ROOT);
        Set<String> categories = new LinkedHashSet<>();

        if (containsAny(text, " if ", " else ", "boolean", "condition", "logic")) categories.add("conditionals");
        if (containsAny(text, " for ", " while ", "loop")) categories.add("loops");
        if (containsAny(text, "array", "list", "index", "map")) categories.add("arrays");
        if (containsAny(text, "string", "char", "substring", "concat")) categories.add("strings");
        if (containsAny(text, "async", "await", "promise", "callback")) categories.add("async");
        if (containsAny(text, "null", "undefined", "optional", "nil")) categories.add("null_safety");
        if (containsAny(text, "sql", "query", "join", "select", "where")) categories.add("sql");
        if (containsAny(text, "class", "object", "constructor", "method")) categories.add("oop");
        if (containsAny(text, "function", "return", "argument", "parameter")) categories.add("functions");

        if (categories.isEmpty()) {
            categories.add("general");
        }
        return categories.stream().limit(3).toList();
    }

    private String inferBugPattern(Challenge challenge) {
        String text = (challenge.getTopic() + " " + challenge.getBuggyCode()).toLowerCase(Locale.ROOT);
        if (containsAny(text, "<=", ">=", "index", "length", "size", "array", "list")) return "Boundary or index bug";
        if (containsAny(text, " if ", " else ", "boolean", "condition", "&&", "||")) return "Incorrect condition";
        if (containsAny(text, "null", "undefined", "optional", "nil", "none")) return "Missing empty-value guard";
        if (containsAny(text, "return", "function", "method")) return "Wrong return behavior";
        if (containsAny(text, "async", "await", "promise", "callback")) return "Async ordering bug";
        if (containsAny(text, "string", "substring", "trim", "lower", "upper")) return "String handling bug";
        return "General logic bug";
    }

    private LearningDto.LearningSummaryResponse buildSummary(List<LearningAttempt> attempts, List<LearningCategoryStat> stats) {
        if (attempts.isEmpty()) {
            return new LearningDto.LearningSummaryResponse(0, 0, 0, 0, 0, 0, dueReviewCategories(stats, 999).size());
        }

        int total = attempts.size();
        int correct = (int) attempts.stream().filter(item -> "CORRECT".equals(item.getVerdict())).count();
        int partial = (int) attempts.stream().filter(item -> "PARTIAL".equals(item.getVerdict())).count();
        int wrong = (int) attempts.stream().filter(item -> "WRONG".equals(item.getVerdict())).count();
        int avgDuration = (int) Math.round(attempts.stream().mapToInt(LearningAttempt::getDurationSec).average().orElse(0));
        double avgHint = Math.round(attempts.stream().mapToInt(LearningAttempt::getHintLevel).average().orElse(0) * 10.0) / 10.0;

        return new LearningDto.LearningSummaryResponse(
                total,
                Math.round((correct * 100f) / total),
                Math.round((partial * 100f) / total),
                Math.round((wrong * 100f) / total),
                avgDuration,
                avgHint,
                dueReviewCategories(stats, 999).size()
        );
    }

    private LearningDto.ReviewPlanResponse buildReviewPlan(List<LearningCategoryStat> stats) {
        List<String> targetCategories = dueReviewCategories(stats, 3);
        if (targetCategories.isEmpty()) {
            targetCategories = weakestCategories(stats, 3);
        }
        if (targetCategories.isEmpty()) {
            return null;
        }

        String primary = targetCategories.get(0);
        LearningCategoryStat primaryStat = stats.stream()
                .filter(item -> item.getCategory().equals(primary))
                .findFirst()
                .orElse(null);
        String reason = primaryStat == null
                ? "Practice " + label(primary) + " before moving on."
                : label(primary) + " needs review: " + Math.round(primaryStat.getConfidence() * 100) + "% confidence after " + primaryStat.getAttempts() + " attempts.";

        return new LearningDto.ReviewPlanResponse(
                targetCategories,
                targetCategories.stream().map(this::label).reduce((a, b) -> a + ", " + b).orElse("General debugging"),
                reason
        );
    }

    private List<String> weakestCategories(List<LearningCategoryStat> stats, int limit) {
        return stats.stream()
                .sorted(Comparator.comparingDouble(LearningCategoryStat::getConfidence))
                .limit(limit)
                .map(LearningCategoryStat::getCategory)
                .toList();
    }

    private List<String> dueReviewCategories(List<LearningCategoryStat> stats, int limit) {
        Instant now = Instant.now();
        return stats.stream()
                .filter(stat -> !stat.getNextReviewAt().isAfter(now))
                .sorted(Comparator.comparingDouble(LearningCategoryStat::getConfidence))
                .limit(limit)
                .map(LearningCategoryStat::getCategory)
                .toList();
    }

    private PracticeMode recommendPracticeMode(List<LearningCategoryStat> stats, String topic) {
        if (topic != null && !topic.isBlank()) {
            return recommendedModeForText(topic.toLowerCase(Locale.ROOT));
        }

        List<String> due = dueReviewCategories(stats, 1);
        if (!due.isEmpty()) {
            return recommendedModeForCategory(due.get(0));
        }

        return stats.stream()
                .min(Comparator.comparingDouble(LearningCategoryStat::getConfidence))
                .map(LearningCategoryStat::getRecommendedMode)
                .orElse(PracticeMode.BUG_HUNT);
    }

    private PracticeMode recommendedModeForCategory(String category) {
        return switch (category) {
            case "arrays", "loops", "conditionals" -> PracticeMode.OUTPUT_TRACING;
            case "null_safety", "strings", "async" -> PracticeMode.EDGE_CASE_RESCUE;
            case "functions", "oop", "sql" -> PracticeMode.TEST_FIRST;
            default -> PracticeMode.BUG_HUNT;
        };
    }

    private PracticeMode recommendedModeForText(String text) {
        if (containsAny(text, "worked", "example", "study", "walkthrough")) {
            return PracticeMode.WORKED_EXAMPLE;
        }
        if (containsAny(text, "array", "loop", "condition", "trace", "index", "branch")) {
            return PracticeMode.OUTPUT_TRACING;
        }
        if (containsAny(text, "edge", "null", "undefined", "empty", "guard", "string", "async")) {
            return PracticeMode.EDGE_CASE_RESCUE;
        }
        if (containsAny(text, "test", "behavior", "expected", "function", "sql", "object")) {
            return PracticeMode.TEST_FIRST;
        }
        return PracticeMode.BUG_HUNT;
    }

    private String label(String category) {
        return switch (category) {
            case "conditionals" -> "Conditionals";
            case "loops" -> "Loops";
            case "arrays" -> "Arrays";
            case "strings" -> "Strings";
            case "async" -> "Async";
            case "null_safety" -> "Null safety";
            case "sql" -> "SQL";
            case "oop" -> "OOP";
            case "functions" -> "Functions";
            default -> "General debugging";
        };
    }

    private boolean containsAny(String text, String... needles) {
        for (String needle : needles) {
            if (text.contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private String normalizeVerdict(String verdict) {
        if ("CORRECT".equals(verdict) || "PARTIAL".equals(verdict) || "WRONG".equals(verdict)) {
            return verdict;
        }
        return "WRONG";
    }

    private List<String> sanitizeHelpUsed(List<String> helpUsed) {
        if (helpUsed == null) {
            return List.of();
        }
        return helpUsed.stream()
                .filter(item -> item != null && !item.isBlank())
                .map(item -> item.trim().toLowerCase(Locale.ROOT))
                .distinct()
                .limit(MAX_HELP_ITEMS)
                .toList();
    }

    private String fingerprint(String code) {
        if (code == null) {
            return "";
        }
        String normalized = code.replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
        return normalized.length() <= 120 ? normalized : normalized.substring(0, 120);
    }

    private double scoreAttempt(String verdict, int hintLevel, int durationSec) {
        double verdictScore = switch (verdict) {
            case "CORRECT" -> 1.0;
            case "PARTIAL" -> 0.62;
            default -> 0.25;
        };
        double hintPenalty = hintLevel * 0.12;
        double durationPenalty = durationSec > 900 ? 0.12 : durationSec > 600 ? 0.08 : 0;
        return clamp01(verdictScore - hintPenalty - durationPenalty);
    }

    private Duration reviewInterval(String verdict, int hintLevel, int attemptsOnChallenge) {
        if (attemptsOnChallenge >= 3 || "WRONG".equals(verdict)) return Duration.ofDays(1);
        if ("PARTIAL".equals(verdict)) return Duration.ofDays(3);
        return hintLevel >= 2 ? Duration.ofDays(4) : Duration.ofDays(7);
    }

    private double clamp01(double value) {
        return Math.max(0, Math.min(1, value));
    }
}
