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
import java.util.List;
import java.util.Random;

@Slf4j
@Component
@RequiredArgsConstructor
public class ChallengeGenerator {

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;

    @Value("classpath:prompts/generate-challenge.st")
    private Resource promptTemplate;

    private static final List<String> DEFAULT_TOPICS = List.of(
            "Arrays and loops", "String manipulation", "Recursion",
            "Object-oriented design", "Error handling", "Collections",
            "Sorting algorithms", "File I/O", "Concurrency", "APIs"
    );

    public GeneratedChallenge generate(String programmingLanguage, PlayerLevel level, String topic, PracticeMode practiceMode) {
        String resolvedTopic = (topic != null && !topic.isBlank())
                ? topic
                : DEFAULT_TOPICS.get(new Random().nextInt(DEFAULT_TOPICS.size()));

        String renderedPrompt = renderPrompt(level, programmingLanguage, resolvedTopic, practiceMode);

        String response = chatClient.prompt()
                .user(renderedPrompt)
                .call()
                .content();

        try {
            String clean = cleanJson(response);
            return objectMapper.readValue(clean, GeneratedChallenge.class);
        } catch (Exception e) {
            log.error("Failed to parse challenge JSON: {}", response, e);
            log.warn("Falling back to built-in challenge for topic='{}', language='{}', mode='{}'",
                    resolvedTopic, programmingLanguage, practiceMode);
            return buildFallbackChallenge(programmingLanguage, resolvedTopic, practiceMode);
        }
    }

    private GeneratedChallenge buildFallbackChallenge(String programmingLanguage, String topic, PracticeMode practiceMode) {
        String lang = programmingLanguage == null ? "java" : programmingLanguage.trim().toLowerCase();

        if (lang.contains("python")) {
            return new GeneratedChallenge(
                    "def find_max(arr):\n    max_value = arr[0]\n    for i in range(len(arr)):\n        if arr[i] > max_value:\n            return arr[0]\n    return max_value\n",
                    "def find_max(arr):\n    if not arr:\n        return None\n    max_value = arr[0]\n    for i in range(1, len(arr)):\n        if arr[i] > max_value:\n            max_value = arr[i]\n    return max_value\n",
                    "The function returns too early inside the loop and always returns the first element instead of the maximum.",
                    "Check where the return statement is placed inside the loop.",
                    "Debug a {} mission in {} mode: fix a max-in-array function so it scans all elements.".formatted(topic, practiceMode.name()),
                    "The function should return the maximum value for non-empty arrays and avoid premature return.",
                    "What test cases prove your fix handles both increasing and mixed arrays?"
            );
        }

        if (lang.contains("javascript") || lang.equals("js") || lang.equals("ts") || lang.contains("typescript")) {
            return new GeneratedChallenge(
                    "function findMax(arr) {\n  let max = arr[0];\n  for (let i = 0; i < arr.length; i++) {\n    if (arr[i] > max) {\n      return arr[0];\n    }\n  }\n  return max;\n}\n",
                    "function findMax(arr) {\n  if (!arr || arr.length === 0) return null;\n  let max = arr[0];\n  for (let i = 1; i < arr.length; i++) {\n    if (arr[i] > max) {\n      max = arr[i];\n    }\n  }\n  return max;\n}\n",
                    "The loop returns early when it finds a larger value, so it never updates max correctly.",
                    "Use assignment to update max, and return only after the loop finishes.",
                    "Debug a {} mission in {} mode: repair a JavaScript max finder.".formatted(topic, practiceMode.name()),
                    "Return the maximum number for normal arrays and null for empty input.",
                    "Which edge cases would break the original implementation?"
            );
        }

        return new GeneratedChallenge(
                "public class ArrayUtils {\n    public static int findMax(int[] arr) {\n        int max = arr[0];\n        for (int i = 0; i < arr.length; i++) {\n            if (arr[i] > max) {\n                return arr[0];\n            }\n        }\n        return max;\n    }\n}\n",
                "public class ArrayUtils {\n    public static int findMax(int[] arr) {\n        if (arr == null || arr.length == 0) {\n            throw new IllegalArgumentException(\"Array must not be empty\");\n        }\n\n        int max = arr[0];\n        for (int i = 1; i < arr.length; i++) {\n            if (arr[i] > max) {\n                max = arr[i];\n            }\n        }\n        return max;\n    }\n}\n",
                "The method returns from inside the loop, so it exits early and does not compute the true maximum.",
                "Look at the return statement inside the loop and consider when max should be updated.",
                "Debug a {} mission in {} mode: fix a Java array maximum function.".formatted(topic, practiceMode.name()),
                "The method should return the correct maximum and guard against null/empty arrays.",
                "How does your fix behave for [1,2,3,4], [4,1,3], and negative numbers?"
        );
    }

    private String cleanJson(String raw) {
        if (raw == null) return "{}";
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

    private String renderPrompt(PlayerLevel level, String programmingLanguage, String topic, PracticeMode practiceMode) {
        try {
            String template = promptTemplate.getContentAsString(StandardCharsets.UTF_8);
            return template
                    .replace("{level}", level.name())
                    .replace("{programmingLanguage}", programmingLanguage)
                    .replace("{topic}", topic)
                    .replace("{practiceMode}", practiceMode.name());
        } catch (IOException e) {
            throw new RuntimeException("Failed to load challenge generation prompt", e);
        }
    }

    public record GeneratedChallenge(
            String buggyCode,
            String correctCode,
            String bugExplanation,
            String hint,
            String missionBrief,
            String successCriteria,
            String reflectionPrompt
    ) {}
}
