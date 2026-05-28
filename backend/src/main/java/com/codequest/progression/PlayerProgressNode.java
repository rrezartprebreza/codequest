package com.codequest.progression;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "player_progress_nodes",
        uniqueConstraints = @UniqueConstraint(name = "uq_player_node", columnNames = {"player_id", "node_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlayerProgressNode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false)
    private UUID playerId;

    @Column(nullable = false)
    private UUID nodeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProgressStatus status;

    private int starsEarned;

    private Instant completedAt;

    @CreationTimestamp
    @Column(updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    public static PlayerProgressNode create(UUID playerId, UUID nodeId, ProgressStatus status) {
        PlayerProgressNode record = new PlayerProgressNode();
        record.playerId = playerId;
        record.nodeId = nodeId;
        record.status = status;
        return record;
    }

    public void markActive() {
        this.status = ProgressStatus.ACTIVE;
    }

    public void markLocked() {
        this.status = ProgressStatus.LOCKED;
    }

    public void markCompleted() {
        this.status = ProgressStatus.COMPLETED;
        this.completedAt = Instant.now();
    }

    public void markCompleted(int stars) {
        this.status = ProgressStatus.COMPLETED;
        this.starsEarned = stars;
        this.completedAt = Instant.now();
    }
}

