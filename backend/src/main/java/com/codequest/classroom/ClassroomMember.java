package com.codequest.classroom;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "classroom_members", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"classroom_id", "player_id"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ClassroomMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "classroom_id", nullable = false)
    private UUID classroomId;

    @Column(name = "player_id", nullable = false)
    private UUID playerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role = Role.STUDENT;

    @CreationTimestamp
    @Column(name = "joined_at", updatable = false, nullable = false)
    private Instant joinedAt;

    public static ClassroomMember create(UUID classroomId, UUID playerId, Role role) {
        ClassroomMember m = new ClassroomMember();
        m.classroomId = classroomId;
        m.playerId = playerId;
        m.role = role;
        return m;
    }

    public enum Role { STUDENT, TEACHER }
}
