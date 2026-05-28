package com.codequest.tutor;

import com.codequest.auth.AuthUtils;
import com.codequest.challenge.PlayerChallenge;
import com.codequest.challenge.PlayerChallengeRepository;
import com.codequest.player.PlayerRepository;
import com.codequest.session.GameSession;
import com.codequest.session.SessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.UUID;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TutorService {

    private final ChatClient chatClient;
    private final SessionService sessionService;
    private final PlayerChallengeRepository playerChallengeRepository;
    private final TutorMessageRepository tutorMessageRepository;
    private final PlayerRepository playerRepository;

    @Value("classpath:prompts/tutor-system.st")
    private Resource systemPromptTemplate;

    public Flux<String> chat(String sessionId, String userMessage) {
        UUID me = AuthUtils.requireCurrentPlayerId();
        GameSession session = sessionService.getOrCreate(sessionId);

        // Bind on first contact, enforce on subsequent: stops other authenticated
        // users from hijacking a session by guessing its id.
        if (session.getPlayerId() == null) {
            session.setPlayerId(me);
        } else if (!session.getPlayerId().equals(me)) {
            throw new AccessDeniedException("Session belongs to another user.");
        }

        session.addMessage("user", userMessage);
        persistMessage(session, "user", userMessage);

        List<Message> messages = buildMessages(session, userMessage);

        Flux<String> stream = chatClient.prompt(new Prompt(messages))
                .stream()
                .content();

        StringBuilder fullResponse = new StringBuilder();

        return stream
                .doOnNext(fullResponse::append)
                .doOnComplete(() -> {
                    String assistantContent = fullResponse.toString();
                    session.addMessage("assistant", assistantContent);
                    sessionService.save(session);
                    persistMessage(session, "assistant", assistantContent);
                    log.debug("Saved tutor response to session {}", sessionId);
                })
                .doOnError(e -> log.error("Streaming error for session {}", sessionId, e));
    }

    /**
     * Persist a single message to Postgres so lecturer dashboards can read it after
     * the Redis TTL expires. Failure here is logged but never breaks the stream —
     * the durable copy is non-critical to the live conversation.
     *
     * Skips persistence if the player has opted out via Player.tutorMessagesOptIn.
     */
    private void persistMessage(GameSession session, String role, String content) {
        if (content == null || content.isBlank()) return;
        if (session.getPlayerId() == null) return; // anonymous sessions don't persist
        try {
            boolean optIn = playerRepository.findById(session.getPlayerId())
                    .map(p -> p.isTutorMessagesOptIn())
                    .orElse(false);
            if (!optIn) return;
            tutorMessageRepository.save(TutorMessage.create(
                    session.getPlayerId(),
                    session.getCurrentChallengeId(),
                    session.getSessionId(),
                    role,
                    content
            ));
        } catch (Exception e) {
            log.warn("Could not persist tutor message for session {}: {}", session.getSessionId(), e.getMessage());
        }
    }

    private List<Message> buildMessages(GameSession session, String currentUserMessage) {
        List<Message> messages = new ArrayList<>();

        // System prompt with session context
        String systemPrompt = buildSystemPrompt(session);
        messages.add(new SystemMessage(systemPrompt));

        // Conversation history (excluding the current message)
        List<GameSession.Message> history = session.getConversationHistory();
        for (int i = 0; i < history.size() - 1; i++) { // -1 because current message already added
            GameSession.Message msg = history.get(i);
            if ("user".equals(msg.role())) {
                messages.add(new UserMessage(msg.content()));
            } else {
                messages.add(new AssistantMessage(msg.content()));
            }
        }

        // Current user message
        messages.add(new UserMessage(currentUserMessage));

        return messages;
    }

    private String buildSystemPrompt(GameSession session) {
        try {
            String template = systemPromptTemplate.getContentAsString(StandardCharsets.UTF_8);
            String misconception = resolveLatestMisconception(session);
            String challengeContext = session.getCurrentBuggyCode() != null
                    ? "The student is working on this buggy code:\n```\n" + session.getCurrentBuggyCode() + "\n```\n"
                        + "Practice mode: " + (session.getCurrentPracticeMode() == null ? "BUG_HUNT" : session.getCurrentPracticeMode().name()) + "\n"
                        + "Mission brief: " + blankIfNull(session.getCurrentMissionBrief()) + "\n"
                        + "Success criteria: " + blankIfNull(session.getCurrentSuccessCriteria()) + "\n"
                        + "Reflection prompt: " + blankIfNull(session.getCurrentReflectionPrompt())
                        + (misconception != null
                            ? "\nLatest detected misconception: " + misconception
                              + " — target this mental bug with Socratic questions before suggesting code edits."
                            : "")
                    : "No active challenge — general tutoring mode.";

            return template
                    .replace("{programmingLanguage}", blankIfNull(session.getProgrammingLanguage(), "Java"))
                    .replace("{level}", blankIfNull(session.getPlayerLevel(), "BEGINNER"))
                    .replace("{humanLanguage}", blankIfNull(session.getHumanLanguage(), "en"))
                    .replace("{challengeContext}", challengeContext);
        } catch (IOException e) {
            log.error("Failed to load system prompt template", e);
            return "You are CodeQuest AI — a helpful programming tutor.";
        }
    }

    /**
     * Returns the most recent evaluator-detected misconception for the active challenge.
     * Reads from the session first (cheapest), falls back to the DB.
     */
    private String resolveLatestMisconception(GameSession session) {
        if (session.getLastMisconception() != null && !session.getLastMisconception().isBlank()) {
            return session.getLastMisconception();
        }
        if (session.getPlayerId() == null || session.getCurrentChallengeId() == null) {
            return null;
        }
        return playerChallengeRepository
                .findFirstByPlayerIdAndChallengeIdOrderByStartedAtDesc(
                        session.getPlayerId(), session.getCurrentChallengeId())
                .map(PlayerChallenge::getMisconception)
                .filter(value -> value != null && !value.isBlank())
                .orElse(null);
    }

    private String blankIfNull(String value) {
        return value == null ? "" : value;
    }

    private String blankIfNull(String value, String defaultValue) {
        return value == null ? defaultValue : value;
    }
}
