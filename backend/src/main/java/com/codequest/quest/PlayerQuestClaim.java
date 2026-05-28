package com.codequest.quest;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "player_quest_claims",
        uniqueConstraints = @UniqueConstraint(name = "uq_player_quest_claim", columnNames = {"player_id", "quest_date", "quest_type"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlayerQuestClaim {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false)
    private UUID playerId;

    @Column(nullable = false)
    private LocalDate questDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private QuestType questType;

    @Column(nullable = false)
    private int rewardXp;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant claimedAt;

    public static PlayerQuestClaim claim(UUID playerId, LocalDate questDate, QuestType questType, int rewardXp) {
        PlayerQuestClaim claim = new PlayerQuestClaim();
        claim.playerId = playerId;
        claim.questDate = questDate;
        claim.questType = questType;
        claim.rewardXp = rewardXp;
        return claim;
    }
}
