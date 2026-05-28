package com.codequest.challenge;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface PlayerChallengeRepository extends JpaRepository<PlayerChallenge, UUID> {

    Optional<PlayerChallenge> findFirstByPlayerIdAndChallengeIdAndStatusOrderByStartedAtDesc(
            UUID playerId, UUID challengeId, PlayerChallenge.AttemptStatus status);

    Page<PlayerChallenge> findByPlayerIdOrderByStartedAtDesc(UUID playerId, Pageable pageable);

    long countByPlayerIdAndStatus(UUID playerId, PlayerChallenge.AttemptStatus status);

    long countByPlayerIdAndStartedAtAfter(UUID playerId, Instant after);

    long countByPlayerIdAndStatusAndStartedAtAfter(UUID playerId, PlayerChallenge.AttemptStatus status, Instant after);

    Optional<PlayerChallenge> findFirstByPlayerIdAndChallengeIdOrderByStartedAtDesc(
            UUID playerId, UUID challengeId);
}
