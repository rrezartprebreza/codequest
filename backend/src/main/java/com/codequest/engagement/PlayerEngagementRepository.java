package com.codequest.engagement;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PlayerEngagementRepository extends JpaRepository<PlayerEngagement, UUID> {
    Optional<PlayerEngagement> findByPlayerId(UUID playerId);
}

