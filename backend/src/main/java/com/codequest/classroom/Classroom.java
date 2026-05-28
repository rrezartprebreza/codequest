package com.codequest.classroom;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "classrooms")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Classroom {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "owner_player_id", nullable = false)
    private UUID ownerPlayerId;

    @Column(name = "join_code", nullable = false, length = 10, unique = true)
    private String joinCode;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    public static Classroom create(String name, UUID ownerPlayerId, String joinCode) {
        Classroom c = new Classroom();
        c.name = name;
        c.ownerPlayerId = ownerPlayerId;
        c.joinCode = joinCode;
        return c;
    }
}
