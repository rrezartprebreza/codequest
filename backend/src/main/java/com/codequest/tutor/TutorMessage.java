package com.codequest.tutor;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tutor_messages", indexes = {
        @Index(name = "idx_tutor_messages_player_challenge", columnList = "player_id,challenge_id,created_at"),
        @Index(name = "idx_tutor_messages_player_recent", columnList = "player_id,created_at")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TutorMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "player_id", nullable = false)
    private UUID playerId;

    @Column(name = "challenge_id")
    private UUID challengeId;

    @Column(name = "session_id", nullable = false, length = 120)
    private String sessionId;

    @Column(nullable = false, length = 16)
    private String role;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    public static TutorMessage create(UUID playerId, UUID challengeId, String sessionId, String role, String content) {
        TutorMessage m = new TutorMessage();
        m.playerId = playerId;
        m.challengeId = challengeId;
        m.sessionId = sessionId;
        m.role = role;
        m.content = content;
        return m;
    }
}
