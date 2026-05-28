package com.codequest;

import com.codequest.engagement.PlayerEngagement;
import com.codequest.player.PlayerLevel;
import com.codequest.player.Player;
import com.codequest.challenge.PlayerChallenge;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pure unit tests for core domain logic — no Spring context, no DB, fast.
 */
class CodeQuestApplicationTest {

    // ── Player domain tests (no Spring context needed) ─────────────────────

    @Test
    void player_startsAtBeginner() {
        Player p = Player.register("alice", "alice@test.com", "hashed", "Java", PlayerLevel.BEGINNER);
        assertThat(p.getLevel()).isEqualTo(PlayerLevel.BEGINNER);
        assertThat(p.getCurrentXp()).isZero();
        assertThat(p.getTotalXp()).isZero();
    }

    @Test
    void player_levelUpToIntermediate_at500Xp() {
        Player p = Player.register("bob", "bob@test.com", "hashed", "Python", PlayerLevel.BEGINNER);
        p.awardXp(500);
        assertThat(p.getLevel()).isEqualTo(PlayerLevel.INTERMEDIATE);
        assertThat(p.getTotalXp()).isEqualTo(500);
    }

    @Test
    void player_levelUpToSenior_at2000Xp() {
        Player p = Player.register("carol", "carol@test.com", "hashed", "Go", PlayerLevel.BEGINNER);
        p.awardXp(2000);
        assertThat(p.getLevel()).isEqualTo(PlayerLevel.SENIOR);
    }

    @Test
    void player_levelUpToMaster_at5000Xp() {
        Player p = Player.register("dave", "dave@test.com", "hashed", "Rust", PlayerLevel.BEGINNER);
        p.awardXp(5000);
        assertThat(p.getLevel()).isEqualTo(PlayerLevel.MASTER);
    }

    @Test
    void player_rejectsNegativeXp() {
        Player p = Player.register("eve", "eve@test.com", "hashed", "Java", PlayerLevel.BEGINNER);
        assertThatThrownBy(() -> p.awardXp(-10))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("XP cannot be negative");
    }

    @Test
    void player_streakIncrements_onNewDay() {
        Player p = Player.register("frank", "frank@test.com", "hashed", "JavaScript", PlayerLevel.BEGINNER);
        p.updateStreak();
        assertThat(p.getCurrentStreak()).isEqualTo(1);
        assertThat(p.getLongestStreak()).isEqualTo(1);
    }

    @Test
    void player_previewNextStreak_reflectsSameDayState() {
        Player p = Player.register("gina", "gina@test.com", "hashed", "TypeScript", PlayerLevel.BEGINNER);
        assertThat(p.isNewStreakDay()).isTrue();
        assertThat(p.previewNextStreak()).isEqualTo(1);

        p.updateStreak();

        assertThat(p.isNewStreakDay()).isFalse();
        assertThat(p.previewNextStreak()).isEqualTo(1);
    }

    // ── Engagement domain tests ──────────────────────────────────────────────

    @Test
    void engagement_refillsHeart_afterConfiguredInterval() {
        PlayerEngagement engagement = PlayerEngagement.create(UUID.randomUUID());
        engagement.applyDefaults(5, 3);

        Instant start = Instant.parse("2026-04-28T10:00:00Z");
        engagement.consumeHeart(start);
        assertThat(engagement.getHeartsRemaining()).isEqualTo(4);

        engagement.refresh(start.plus(Duration.ofMinutes(30)), Duration.ofMinutes(30));
        assertThat(engagement.getHeartsRemaining()).isEqualTo(5);
    }

    @Test
    void engagement_claimsDailyGoalReward_once() {
        PlayerEngagement engagement = PlayerEngagement.create(UUID.randomUUID());
        engagement.applyDefaults(5, 3);

        assertThat(engagement.recordCompletedLesson()).isFalse();
        assertThat(engagement.recordCompletedLesson()).isFalse();
        assertThat(engagement.recordCompletedLesson()).isTrue();
        assertThat(engagement.recordCompletedLesson()).isFalse();
        assertThat(engagement.isDailyGoalRewardClaimed()).isTrue();
        assertThat(engagement.getLessonsCompletedToday()).isEqualTo(4);
    }

    // ── PlayerChallenge domain tests ────────────────────────────────────────

    @Test
    void playerChallenge_startsInProgress() {
        UUID pid = UUID.randomUUID();
        UUID cid = UUID.randomUUID();
        PlayerChallenge pc = PlayerChallenge.start(pid, cid);
        assertThat(pc.getStatus()).isEqualTo(PlayerChallenge.AttemptStatus.IN_PROGRESS);
        assertThat(pc.getHintsUsed()).isZero();
    }

    @Test
    void playerChallenge_incrementsHints() {
        PlayerChallenge pc = PlayerChallenge.start(UUID.randomUUID(), UUID.randomUUID());
        pc.incrementHints();
        pc.incrementHints();
        assertThat(pc.getHintsUsed()).isEqualTo(2);
    }

    @Test
    void playerChallenge_completesWithXp() {
        PlayerChallenge pc = PlayerChallenge.start(UUID.randomUUID(), UUID.randomUUID());
        pc.complete("fixed code", "Great job!", 150, 90, null);
        assertThat(pc.getStatus()).isEqualTo(PlayerChallenge.AttemptStatus.COMPLETED);
        assertThat(pc.getXpEarned()).isEqualTo(150);
        assertThat(pc.getCompletedAt()).isNotNull();
    }

    @Test
    void playerChallenge_failSetsStatusAndTime() {
        PlayerChallenge pc = PlayerChallenge.start(UUID.randomUUID(), UUID.randomUUID());
        pc.fail("wrong code", "Not quite right.", null);
        assertThat(pc.getStatus()).isEqualTo(PlayerChallenge.AttemptStatus.FAILED);
        assertThat(pc.getCompletedAt()).isNotNull();
    }
}



