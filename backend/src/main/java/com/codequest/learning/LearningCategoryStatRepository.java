package com.codequest.learning;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LearningCategoryStatRepository extends JpaRepository<LearningCategoryStat, UUID> {
    Optional<LearningCategoryStat> findByPlayerIdAndCategory(UUID playerId, String category);
    List<LearningCategoryStat> findByPlayerId(UUID playerId);
}
