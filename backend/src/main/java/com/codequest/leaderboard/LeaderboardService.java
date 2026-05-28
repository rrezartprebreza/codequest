package com.codequest.leaderboard;

import com.codequest.player.Player;
import com.codequest.player.PlayerRepository;
import com.codequest.player.PlayerService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LeaderboardService {

    private final PlayerService playerService;
    private final PlayerRepository playerRepository;

    @Transactional(readOnly = true)
    public LeaderboardDto.LeaderboardResponse getLeagueBoard(UUID playerId, int limit) {
        Player current = playerService.findById(playerId);
        League league = League.fromTotalXp(current.getTotalXp());

        int minXp = minXpFor(league);
        int maxXp = maxXpFor(league);

        List<Player> players = playerRepository
                .findByTotalXpGreaterThanEqualAndTotalXpLessThanEqualOrderByTotalXpDesc(
                        minXp,
                        maxXp,
                        PageRequest.of(0, Math.max(1, limit))
                );

        List<LeaderboardDto.LeaderboardEntry> entries = toEntries(players, current.getId());
        return new LeaderboardDto.LeaderboardResponse(league, entries);
    }

    private List<LeaderboardDto.LeaderboardEntry> toEntries(List<Player> players, UUID currentPlayerId) {
        return java.util.stream.IntStream.range(0, players.size())
                .mapToObj(i -> {
                    Player player = players.get(i);
                    return new LeaderboardDto.LeaderboardEntry(
                            i + 1,
                            player.getId(),
                            player.getUsername(),
                            player.getTotalXp(),
                            player.getCurrentStreak(),
                            League.fromTotalXp(player.getTotalXp()),
                            player.getId().equals(currentPlayerId)
                    );
                })
                .toList();
    }

    private int minXpFor(League league) {
        return switch (league) {
            case BRONZE -> 0;
            case SILVER -> 400;
            case GOLD -> 1200;
            case PLATINUM -> 2500;
            case DIAMOND -> 5000;
        };
    }

    private int maxXpFor(League league) {
        return switch (league) {
            case BRONZE -> 399;
            case SILVER -> 1199;
            case GOLD -> 2499;
            case PLATINUM -> 4999;
            case DIAMOND -> Integer.MAX_VALUE;
        };
    }
}


