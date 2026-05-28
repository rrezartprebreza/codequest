package com.codequest.learning;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LearningAttemptRepository extends JpaRepository<LearningAttempt, UUID> {
    List<LearningAttempt> findByPlayerIdOrderByCreatedAtAsc(UUID playerId, Pageable pageable);
    List<LearningAttempt> findTop300ByPlayerIdOrderByCreatedAtDesc(UUID playerId);
}
