package com.codequest.engagement;

import com.codequest.player.Player;
import com.codequest.player.PlayerService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EngagementService {

    private final PlayerEngagementRepository playerEngagementRepository;
    private final PlayerService playerService;

    @Value("${codequest.engagement.max-hearts:5}")
    private int maxHearts;

    @Value("${codequest.engagement.heart-refill-minutes:30}")
    private long heartRefillMinutes;

    @Value("${codequest.engagement.daily-goal-target:3}")
    private int dailyGoalTarget;

    @Value("${codequest.engagement.daily-goal-bonus-xp:150}")
    private int dailyGoalBonusXp;

    @Value("${codequest.engagement.streak-bonus-per-day:10}")
    private int streakBonusPerDay;

    @Value("${codequest.engagement.max-streak-bonus-xp:50}")
    private int maxStreakBonusXp;

    @Transactional
    public EngagementDto.EngagementResponse getSnapshot(UUID playerId) {
        Player player = playerService.findById(playerId);
        PlayerEngagement engagement = ensureEngagement(playerId);
        refreshAndSave(engagement);
        return toResponse(player, engagement, 0, 0);
    }

    @Transactional
    public void assertCanStartChallenge(UUID playerId) {
        Player player = playerService.findById(playerId);
        PlayerEngagement engagement = ensureEngagement(playerId);
        refreshAndSave(engagement);
        if (engagement.getHeartsRemaining() <= 0) {
            long minutes = engagement.minutesUntilNextHeart(Instant.now(), refillInterval());
            throw new IllegalArgumentException("No hearts remaining. Next heart in " + minutes + " min.");
        }
    }

    @Transactional
    public EngagementDto.EngagementResponse applyWrongSubmission(UUID playerId) {
        Player player = playerService.findById(playerId);
        PlayerEngagement engagement = ensureEngagement(playerId);
        Instant now = Instant.now();
        engagement.refresh(now, refillInterval());
        engagement.consumeHeart(now);
        playerEngagementRepository.save(engagement);
        return toResponse(player, engagement, 0, 0);
    }

    @Transactional
    public RewardResult applyCorrectSubmission(UUID playerId, int baseXp) {
        Player player = playerService.findById(playerId);
        PlayerEngagement engagement = ensureEngagement(playerId);
        refreshAndSave(engagement);

        int streakBonusXp = player.isNewStreakDay()
                ? Math.min(player.previewNextStreak() * streakBonusPerDay, maxStreakBonusXp)
                : 0;
        boolean dailyGoalReached = engagement.recordCompletedLesson();
        int awardedDailyGoalBonusXp = dailyGoalReached ? dailyGoalBonusXp : 0;
        int totalXp = baseXp + streakBonusXp + awardedDailyGoalBonusXp;

        player = playerService.awardXp(playerId, totalXp);
        playerEngagementRepository.save(engagement);
        return new RewardResult(
                totalXp,
                streakBonusXp,
                awardedDailyGoalBonusXp,
                toResponse(player, engagement, streakBonusXp, awardedDailyGoalBonusXp)
        );
    }

    private PlayerEngagement ensureEngagement(UUID playerId) {
        return playerEngagementRepository.findByPlayerId(playerId)
                .map(existing -> {
                    normalize(existing);
                    return existing;
                })
                .orElseGet(() -> playerEngagementRepository.save(createDefault(playerId)));
    }

    private PlayerEngagement createDefault(UUID playerId) {
        PlayerEngagement engagement = PlayerEngagement.create(playerId);
        normalize(engagement);
        return engagement;
    }

    private void normalize(PlayerEngagement engagement) {
        engagement.applyDefaults(maxHearts, dailyGoalTarget);
    }

    private void refreshAndSave(PlayerEngagement engagement) {
        engagement.refresh(Instant.now(), refillInterval());
        playerEngagementRepository.save(engagement);
    }

    private EngagementDto.EngagementResponse toResponse(Player player, PlayerEngagement engagement, int streakBonusXp, int dailyGoalBonusXp) {
        Instant now = Instant.now();
        return new EngagementDto.EngagementResponse(
                engagement.getHeartsRemaining(),
                engagement.getMaxHearts(),
                engagement.minutesUntilNextHeart(now, refillInterval()),
                engagement.getLessonsCompletedToday(),
                engagement.getDailyGoalTarget(),
                engagement.isDailyGoalRewardClaimed(),
                player.getCurrentStreak(),
                player.getLongestStreak(),
                streakBonusXp,
                dailyGoalBonusXp
        );
    }

    private Duration refillInterval() {
        return Duration.ofMinutes(Math.max(1, heartRefillMinutes));
    }

    public record RewardResult(
            int totalXpAwarded,
            int streakBonusXp,
            int dailyGoalBonusXp,
            EngagementDto.EngagementResponse engagement
    ) {}
}


