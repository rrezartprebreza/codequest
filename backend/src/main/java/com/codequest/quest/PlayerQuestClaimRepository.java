package com.codequest.quest;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlayerQuestClaimRepository extends JpaRepository<PlayerQuestClaim, UUID> {
    List<PlayerQuestClaim> findByPlayerIdAndQuestDate(UUID playerId, LocalDate questDate);

    Optional<PlayerQuestClaim> findByPlayerIdAndQuestDateAndQuestType(UUID playerId, LocalDate questDate, QuestType questType);
}
