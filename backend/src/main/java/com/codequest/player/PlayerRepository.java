package com.codequest.player;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlayerRepository extends JpaRepository<Player, UUID> {
    Optional<Player> findByUsername(String username);
    Optional<Player> findByUsernameIgnoreCase(String username);
    Optional<Player> findByEmail(String email);
    Optional<Player> findByEmailIgnoreCase(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    List<Player> findByTotalXpGreaterThanEqualAndTotalXpLessThanEqualOrderByTotalXpDesc(int minXp, int maxXp, PageRequest pageable);
}
