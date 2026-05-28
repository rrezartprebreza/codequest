package com.codequest.tutor;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface TutorMessageRepository extends JpaRepository<TutorMessage, UUID> {
    List<TutorMessage> findByPlayerIdAndChallengeIdOrderByCreatedAtAsc(UUID playerId, UUID challengeId);
    List<TutorMessage> findByPlayerIdOrderByCreatedAtDesc(UUID playerId, Pageable pageable);

    /** Returns the number of messages deleted. Used by the retention job. */
    @Modifying
    @Query("DELETE FROM TutorMessage m WHERE m.createdAt < :cutoff")
    int deleteAllOlderThan(@Param("cutoff") Instant cutoff);
}
