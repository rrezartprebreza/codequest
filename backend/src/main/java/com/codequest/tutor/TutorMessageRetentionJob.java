package com.codequest.tutor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * Periodically prunes old tutor messages so we don't retain student conversation
 * data indefinitely. Default retention: 90 days, configurable.
 *
 * Runs once at startup (after a brief delay) and then daily at 03:15 server time.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TutorMessageRetentionJob {

    private final TutorMessageRepository tutorMessageRepository;

    @Value("${codequest.tutor.retention-days:90}")
    private int retentionDays;

    /** Daily at 03:15 — quiet hours for most cohorts. */
    @Scheduled(cron = "0 15 3 * * *")
    @Transactional
    public void scheduledPrune() {
        prune();
    }

    /**
     * Initial sweep on boot, after a small delay so the app finishes warming up.
     * If the schema migration was just applied, there is nothing to prune — fine.
     */
    @Scheduled(initialDelay = 60_000, fixedDelay = Long.MAX_VALUE)
    @Transactional
    public void initialSweep() {
        prune();
    }

    private void prune() {
        Instant cutoff = Instant.now().minus(Duration.ofDays(retentionDays));
        try {
            int deleted = tutorMessageRepository.deleteAllOlderThan(cutoff);
            if (deleted > 0) {
                log.info("Pruned {} tutor messages older than {} days", deleted, retentionDays);
            }
        } catch (Exception e) {
            log.warn("Tutor message retention sweep failed: {}", e.getMessage());
        }
    }
}
