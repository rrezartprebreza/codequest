package com.codequest.challenge;

import com.codequest.player.PlayerLevel;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "challenges")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Challenge {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false)
    private String topic;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PlayerLevel difficulty;

    @Column(nullable = false)
    private String programmingLanguage;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PracticeMode practiceMode = PracticeMode.BUG_HUNT;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String buggyCode;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String correctCode;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String bugExplanation;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String missionBrief;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String successCriteria;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reflectionPrompt;

    @Column(nullable = false)
    private int xpReward;

    @CreationTimestamp
    @Column(updatable = false)
    private Instant createdAt;

    public static Challenge create(String topic, PlayerLevel difficulty,
                                   String programmingLanguage, PracticeMode practiceMode,
                                   String buggyCode, String correctCode, String bugExplanation,
                                   String missionBrief, String successCriteria, String reflectionPrompt,
                                   int xpReward) {
        Challenge c = new Challenge();
        c.topic = topic;
        c.difficulty = difficulty;
        c.programmingLanguage = programmingLanguage;
        c.practiceMode = practiceMode;
        c.buggyCode = buggyCode;
        c.correctCode = correctCode;
        c.bugExplanation = bugExplanation;
        c.missionBrief = missionBrief;
        c.successCriteria = successCriteria;
        c.reflectionPrompt = reflectionPrompt;
        c.xpReward = xpReward;
        return c;
    }
}
