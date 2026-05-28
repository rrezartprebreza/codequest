package com.codequest.learning;

import com.codequest.challenge.PracticeMode;
import com.codequest.player.PlayerLevel;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "learning_attempts", indexes = {
        @Index(name = "idx_learning_attempts_player_created", columnList = "player_id,created_at"),
        @Index(name = "idx_learning_attempts_player_challenge", columnList = "player_id,challenge_id")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LearningAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "player_id", nullable = false)
    private UUID playerId;

    @Column(name = "challenge_id", nullable = false)
    private UUID challengeId;

    @Column(nullable = false, length = 160)
    private String categories;

    @Column(nullable = false, length = 80)
    private String bugPattern;

    @Column(nullable = false, length = 20)
    private String verdict;

    @Column(nullable = false)
    private int hintLevel;

    @Column(nullable = false)
    private int attemptsOnChallenge;

    @Column(nullable = false, length = 160)
    private String helpUsed;

    @Column(nullable = false)
    private int submissionChars;

    @Column(nullable = false)
    private int durationSec;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PlayerLevel difficulty;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PracticeMode practiceMode = PracticeMode.BUG_HUNT;

    @Column(nullable = false, length = 120)
    private String fingerprint;

    @Column(length = 80)
    private String misconception;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    static LearningAttempt create(LearningService.RecordLearningAttempt command) {
        LearningAttempt attempt = new LearningAttempt();
        attempt.playerId = command.playerId();
        attempt.challengeId = command.challengeId();
        attempt.categories = String.join(",", command.categories());
        attempt.bugPattern = command.bugPattern();
        attempt.verdict = command.verdict();
        attempt.hintLevel = command.hintLevel();
        attempt.attemptsOnChallenge = command.attemptsOnChallenge();
        attempt.helpUsed = String.join(",", command.helpUsed());
        attempt.submissionChars = command.submissionChars();
        attempt.durationSec = command.durationSec();
        attempt.difficulty = command.difficulty();
        attempt.practiceMode = command.practiceMode();
        attempt.fingerprint = command.fingerprint();
        attempt.misconception = command.misconception();
        return attempt;
    }
}
