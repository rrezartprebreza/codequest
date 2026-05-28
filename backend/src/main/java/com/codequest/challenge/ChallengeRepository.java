package com.codequest.challenge;

import com.codequest.player.PlayerLevel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChallengeRepository extends JpaRepository<Challenge, UUID> {

    List<Challenge> findByDifficultyAndProgrammingLanguage(PlayerLevel difficulty, String programmingLanguage);

    Page<Challenge> findByDifficulty(PlayerLevel difficulty, Pageable pageable);

    // Get a random challenge not yet completed by this player
    @Query(value = """
        SELECT c.* FROM challenges c
        WHERE c.difficulty = :difficulty
        AND c.programming_language = :lang
        AND c.practice_mode = :practiceMode
        AND c.id NOT IN (
            SELECT pc.challenge_id FROM player_challenges pc
            WHERE pc.player_id = :playerId AND pc.status = 'COMPLETED'
        )
        ORDER BY RANDOM()
        LIMIT 1
        """, nativeQuery = true)
    Optional<Challenge> findRandomForPlayer(
            @Param("playerId") UUID playerId,
            @Param("difficulty") String difficulty,
            @Param("lang") String lang,
            @Param("practiceMode") String practiceMode
    );

    // Same as above but prefers challenges whose topic matches the focus hint.
    // Uses ILIKE for case-insensitive partial match so "loops" hits "Loops and arrays" etc.
    @Query(value = """
        SELECT c.* FROM challenges c
        WHERE c.difficulty = :difficulty
        AND c.programming_language = :lang
        AND c.practice_mode = :practiceMode
        AND c.topic ILIKE CONCAT('%', :topic, '%')
        AND c.id NOT IN (
            SELECT pc.challenge_id FROM player_challenges pc
            WHERE pc.player_id = :playerId AND pc.status = 'COMPLETED'
        )
        ORDER BY RANDOM()
        LIMIT 1
        """, nativeQuery = true)
    Optional<Challenge> findRandomForPlayerByTopic(
            @Param("playerId") UUID playerId,
            @Param("difficulty") String difficulty,
            @Param("lang") String lang,
            @Param("practiceMode") String practiceMode,
            @Param("topic") String topic
    );
}
