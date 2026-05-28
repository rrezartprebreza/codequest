package com.codequest.challenge;

import com.codequest.player.PlayerLevel;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class SolutionEvaluator {

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;

    @Value("classpath:prompts/evaluate-solution.st")
    private Resource promptTemplate;

    private static final Set<String> ALLOWED_VERDICTS = Set.of("CORRECT", "PARTIAL", "WRONG");

    private static final Set<String> ALLOWED_MISCONCEPTIONS = Set.of(
            "off_by_one_inclusive",
            "wrong_boundary_condition",
            "missing_null_guard",
            "wrong_branch_logic",
            "assignment_vs_comparison",
            "premature_return",
            "async_not_awaited",
            "mutation_in_iteration",
            "type_coercion_surprise",
            "wrong_default_value",
            "copy_paste_bug",
            "did_not_change_logic"
    );

    public EvaluationResult evaluate(
            String buggyCode, String correctCode,
            String studentSolution, PlayerLevel level,
            String programmingLanguage, String humanLanguage,
            int hintsUsed, int maxXp) {

        if (normalizeCode(studentSolution).equals(normalizeCode(buggyCode))) {
            return new EvaluationResult(
                    "WRONG",
                    "You submitted the original buggy code without changing the logic. Make at least one meaningful fix before submitting again.",
                    0,
                    "Compare your code against the bug and change the condition, operator, or return value that causes the failure.",
                    "did_not_change_logic"
            );
        }

        String renderedPrompt;
        try {
            renderedPrompt = renderPrompt(
                    buggyCode, correctCode, studentSolution,
                    level, programmingLanguage, humanLanguage,
                    hintsUsed, maxXp
            );
        } catch (Exception e) {
            log.error("Failed to render evaluation prompt", e);
            return fallbackEvaluation();
        }

        String response;
        try {
            response = chatClient.prompt()
                    .user(renderedPrompt)
                    .call()
                    .content();
        } catch (Exception e) {
            log.error("Evaluator AI call failed", e);
            return fallbackEvaluation();
        }

        if (response == null || response.isBlank()) {
            log.warn("Evaluator returned empty response");
            return fallbackEvaluation();
        }

        try {
            String clean = cleanJson(response);
            EvaluationResult parsed = objectMapper.readValue(clean, EvaluationResult.class);
            if (parsed.verdict() == null || parsed.feedback() == null) {
                log.warn("Evaluator response missing required fields: {}", clean);
                return fallbackEvaluation();
            }
            return sanitize(parsed, maxXp);
        } catch (Exception e) {
            log.error("Failed to parse evaluation JSON: {}", response, e);
            return fallbackEvaluation();
        }
    }

    private EvaluationResult fallbackEvaluation() {
        return new EvaluationResult(
                "WRONG",
                "I could not evaluate this submission right now. Please try again in a moment.",
                0,
                "Keep going - your next attempt can still be correct.",
                null
        );
    }

    private EvaluationResult sanitize(EvaluationResult parsed, int maxXp) {
        String verdict = parsed.verdict() == null
                ? "WRONG"
                : parsed.verdict().trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_VERDICTS.contains(verdict)) {
            verdict = "WRONG";
        }

        String feedback = parsed.feedback() == null || parsed.feedback().isBlank()
                ? "I could not evaluate this submission right now. Please try again in a moment."
                : parsed.feedback().trim();

        int xp = Math.max(0, Math.min(parsed.xpEarned(), Math.max(0, maxXp)));

        String encouragement = parsed.encouragement() == null || parsed.encouragement().isBlank()
                ? "Keep going - your next attempt can still be correct."
                : parsed.encouragement().trim();

        String misconception = normalizeMisconception(parsed.misconception());

        return new EvaluationResult(verdict, feedback, xp, encouragement, misconception);
    }

    private String normalizeMisconception(String raw) {
        if (raw == null) return null;
        String value = raw.trim().toLowerCase(Locale.ROOT);
        if (value.isEmpty() || "none".equals(value)) return null;
        return ALLOWED_MISCONCEPTIONS.contains(value) ? value : null;
    }

    private String normalizeCode(String code) {
        if (code == null) {
            return "";
        }
        return code.replaceAll("\\s+", " ").trim();
    }

    private String cleanJson(String raw) {
        if (raw == null) {
            return "{}";
        }

        String s = raw.replaceAll("(?s)```(?:json)?\\s*", "").replaceAll("```", "").trim();
        int start = s.indexOf('{');
        int end = s.lastIndexOf('}');
        if (start >= 0 && end > start) {
            s = s.substring(start, end + 1);
        }
        return escapeNewlinesInsideJsonStrings(s);
    }

    private String escapeNewlinesInsideJsonStrings(String json) {
        StringBuilder out = new StringBuilder(json.length() + 32);
        boolean inString = false;
        boolean escaped = false;

        for (int i = 0; i < json.length(); i++) {
            char ch = json.charAt(i);

            if (inString) {
                if (escaped) {
                    out.append(ch);
                    escaped = false;
                    continue;
                }

                if (ch == '\\') {
                    out.append(ch);
                    escaped = true;
                    continue;
                }

                if (ch == '"') {
                    out.append(ch);
                    inString = false;
                    continue;
                }

                if (ch == '\n') {
                    out.append("\\\\n");
                    continue;
                }

                if (ch == '\r') {
                    continue;
                }

                out.append(ch);
                continue;
            }

            if (ch == '"') {
                inString = true;
            }
            out.append(ch);
        }

        return out.toString();
    }

    private String renderPrompt(
            String buggyCode,
            String correctCode,
            String studentSolution,
            PlayerLevel level,
            String programmingLanguage,
            String humanLanguage,
            int hintsUsed,
            int maxXp
    ) {
        try {
            String template = promptTemplate.getContentAsString(StandardCharsets.UTF_8);
            return template
                    .replace("{level}", level.name())
                    .replace("{programmingLanguage}", programmingLanguage)
                    .replace("{humanLanguage}", humanLanguage)
                    .replace("{buggyCode}", buggyCode)
                    .replace("{correctCode}", correctCode)
                    .replace("{studentSolution}", studentSolution)
                    .replace("{hintsUsed}", String.valueOf(hintsUsed))
                    .replace("{maxXp}", String.valueOf(maxXp));
        } catch (IOException e) {
            throw new RuntimeException("Failed to load solution evaluation prompt", e);
        }
    }

    public record EvaluationResult(
            String verdict,
            String feedback,
            int xpEarned,
            String encouragement,
            String misconception
    ) {
        public boolean isCorrect() { return "CORRECT".equals(verdict); }
        public boolean isPartial() { return "PARTIAL".equals(verdict); }
    }
}
