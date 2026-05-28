package com.codequest.learning;

import com.codequest.challenge.PracticeMode;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "learning_category_stats",
        uniqueConstraints = @UniqueConstraint(name = "uk_learning_category_player_category", columnNames = {"player_id", "category"}),
        indexes = @Index(name = "idx_learning_category_player_review", columnList = "player_id,next_review_at"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LearningCategoryStat {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "player_id", nullable = false)
    private UUID playerId;

    @Column(nullable = false, length = 60)
    private String category;

    @Column(nullable = false)
    private int attempts;

    @Column(nullable = false)
    private int correct;

    @Column(nullable = false)
    private int partial;

    @Column(nullable = false)
    private int wrong;

    @Column(nullable = false)
    private double confidence = 0.5;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PracticeMode recommendedMode = PracticeMode.BUG_HUNT;

    @Column(name = "next_review_at", nullable = false)
    private Instant nextReviewAt = Instant.now();

    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt = Instant.now();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    static LearningCategoryStat create(UUID playerId, String category) {
        LearningCategoryStat stat = new LearningCategoryStat();
        stat.playerId = playerId;
        stat.category = category;
        return stat;
    }

    void record(String verdict, double score, Instant now, Instant nextReviewAt, PracticeMode recommendedMode) {
        attempts += 1;
        if ("CORRECT".equals(verdict)) {
            correct += 1;
        } else if ("PARTIAL".equals(verdict)) {
            partial += 1;
        } else {
            wrong += 1;
        }
        confidence = clamp01(confidence * 0.75 + score * 0.25);
        this.recommendedMode = recommendedMode == null ? PracticeMode.BUG_HUNT : recommendedMode;
        this.nextReviewAt = nextReviewAt;
        this.lastSeenAt = now;
    }

    private double clamp01(double value) {
        return Math.max(0, Math.min(1, value));
    }
}
