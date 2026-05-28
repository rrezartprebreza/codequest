package com.codequest.progression;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlayerProgressNodeRepository extends JpaRepository<PlayerProgressNode, UUID> {
    List<PlayerProgressNode> findByPlayerId(UUID playerId);

    Optional<PlayerProgressNode> findByPlayerIdAndStatus(UUID playerId, ProgressStatus status);

    long countByPlayerIdAndCompletedAtAfter(UUID playerId, java.time.Instant after);
}

