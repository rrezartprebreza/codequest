package com.codequest.engagement;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "player_engagement")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlayerEngagement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false, unique = true)
    private UUID playerId;

    @Column(nullable = false)
    private int heartsRemaining = 5;

    @Column(nullable = false)
    private int maxHearts = 5;

    @Column(nullable = false)
    private Instant lastHeartRefillAt = Instant.now();

    @Column(nullable = false)
    private int dailyGoalTarget = 3;

    @Column(nullable = false)
    private int lessonsCompletedToday = 0;

    @Column(nullable = false)
    private LocalDate dailyGoalDate = LocalDate.now();

    @Column(nullable = false)
    private boolean dailyGoalRewardClaimed = false;

    @CreationTimestamp
    @Column(updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    public static PlayerEngagement create(UUID playerId) {
        PlayerEngagement engagement = new PlayerEngagement();
        engagement.playerId = playerId;
        return engagement;
    }

    public void applyDefaults(int defaultMaxHearts, int defaultDailyGoalTarget) {
        if (maxHearts <= 0) {
            maxHearts = defaultMaxHearts;
        }
        if (dailyGoalTarget <= 0) {
            dailyGoalTarget = defaultDailyGoalTarget;
        }
        heartsRemaining = Math.max(0, Math.min(heartsRemaining, maxHearts));
    }

    public void refresh(Instant now, Duration refillInterval) {
        LocalDate today = LocalDate.now();
        if (dailyGoalDate == null || !dailyGoalDate.equals(today)) {
            dailyGoalDate = today;
            lessonsCompletedToday = 0;
            dailyGoalRewardClaimed = false;
        }

        if (lastHeartRefillAt == null) {
            lastHeartRefillAt = now;
        }

        if (heartsRemaining >= maxHearts) {
            heartsRemaining = maxHearts;
            lastHeartRefillAt = now;
            return;
        }

        long intervalMinutes = Math.max(1, refillInterval.toMinutes());
        long elapsedMinutes = Math.max(0, Duration.between(lastHeartRefillAt, now).toMinutes());
        int heartsToRefill = (int) (elapsedMinutes / intervalMinutes);
        if (heartsToRefill <= 0) {
            return;
        }

        heartsRemaining = Math.min(maxHearts, heartsRemaining + heartsToRefill);
        if (heartsRemaining >= maxHearts) {
            lastHeartRefillAt = now;
        } else {
            lastHeartRefillAt = lastHeartRefillAt.plus(refillInterval.multipliedBy(heartsToRefill));
        }
    }

    public void consumeHeart(Instant now) {
        if (heartsRemaining <= 0) {
            heartsRemaining = 0;
            return;
        }
        boolean wasFull = heartsRemaining >= maxHearts;
        heartsRemaining -= 1;
        if (wasFull || lastHeartRefillAt == null) {
            lastHeartRefillAt = now;
        }
    }

    public boolean recordCompletedLesson() {
        lessonsCompletedToday += 1;
        if (!dailyGoalRewardClaimed && lessonsCompletedToday >= dailyGoalTarget) {
            dailyGoalRewardClaimed = true;
            return true;
        }
        return false;
    }

    public long minutesUntilNextHeart(Instant now, Duration refillInterval) {
        if (heartsRemaining >= maxHearts) {
            return 0;
        }
        long intervalMinutes = Math.max(1, refillInterval.toMinutes());
        long elapsedMinutes = Math.max(0, Duration.between(lastHeartRefillAt, now).toMinutes());
        long remainder = elapsedMinutes % intervalMinutes;
        return remainder == 0 ? intervalMinutes : intervalMinutes - remainder;
    }
}


