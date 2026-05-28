package com.codequest.challenge;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "player_challenges")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlayerChallenge {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false)
    private UUID playerId;

    @Column(nullable = false)
    private UUID challengeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AttemptStatus status = AttemptStatus.IN_PROGRESS;

    @Column(columnDefinition = "TEXT")
    private String studentSolution;

    @Column(columnDefinition = "TEXT")
    private String aiFeedback;

    @Column(length = 80)
    private String misconception;

    @Column(nullable = false)
    private int hintsUsed = 0;

    private Integer xpEarned;
    private Integer timeSpentSeconds;

    @Column(nullable = false)
    private Instant startedAt = Instant.now();

    private Instant completedAt;

    public static PlayerChallenge start(UUID playerId, UUID challengeId) {
        PlayerChallenge pc = new PlayerChallenge();
        pc.playerId = playerId;
        pc.challengeId = challengeId;
        return pc;
    }

    public void complete(String solution, String feedback, int xpEarned, int timeSpentSeconds, String misconception) {
        this.studentSolution = solution;
        this.aiFeedback = feedback;
        this.misconception = misconception;
        this.xpEarned = xpEarned;
        this.timeSpentSeconds = timeSpentSeconds;
        this.status = AttemptStatus.COMPLETED;
        this.completedAt = Instant.now();
    }

    public void fail(String solution, String feedback, String misconception) {
        this.studentSolution = solution;
        this.aiFeedback = feedback;
        this.misconception = misconception;
        this.status = AttemptStatus.FAILED;
        this.completedAt = Instant.now();
    }

    public void incrementHints() {
        this.hintsUsed++;
    }

    public enum AttemptStatus {
        IN_PROGRESS, COMPLETED, FAILED
    }
}
