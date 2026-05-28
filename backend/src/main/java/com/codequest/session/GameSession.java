package com.codequest.session;

import com.codequest.challenge.PracticeMode;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class GameSession implements Serializable {

    private String sessionId;
    private UUID playerId;
    private String programmingLanguage;
    private String playerLevel;
    private String humanLanguage;
    private UUID currentChallengeId;
    private String currentBuggyCode;
    private PracticeMode currentPracticeMode;
    private String currentMissionBrief;
    private String currentSuccessCriteria;
    private String currentReflectionPrompt;
    /** Last evaluator-detected misconception for this challenge — drives Socratic targeting. */
    private String lastMisconception;

    @Builder.Default
    private List<Message> conversationHistory = new ArrayList<>();

    @Builder.Default
    private int totalHintsUsed = 0;

    public void addMessage(String role, String content) {
        conversationHistory.add(new Message(role, content));
        if (conversationHistory.size() > 20) {
            conversationHistory = new ArrayList<>(
                    conversationHistory.subList(conversationHistory.size() - 20, conversationHistory.size())
            );
        }
    }

    public void setCurrentChallenge(
            UUID challengeId,
            String buggyCode,
            PracticeMode practiceMode,
            String missionBrief,
            String successCriteria,
            String reflectionPrompt
    ) {
        this.currentChallengeId = challengeId;
        this.currentBuggyCode = buggyCode;
        this.currentPracticeMode = practiceMode;
        this.currentMissionBrief = missionBrief;
        this.currentSuccessCriteria = successCriteria;
        this.currentReflectionPrompt = reflectionPrompt;
        this.conversationHistory.clear();
        this.totalHintsUsed = 0;
        this.lastMisconception = null;
    }

    public record Message(String role, String content) {}
}
