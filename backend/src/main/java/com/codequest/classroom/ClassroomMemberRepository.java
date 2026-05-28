package com.codequest.classroom;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ClassroomMemberRepository extends JpaRepository<ClassroomMember, UUID> {
    List<ClassroomMember> findByClassroomId(UUID classroomId);
    List<ClassroomMember> findByPlayerId(UUID playerId);
    Optional<ClassroomMember> findByClassroomIdAndPlayerId(UUID classroomId, UUID playerId);
}
