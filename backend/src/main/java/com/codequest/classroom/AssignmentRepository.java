package com.codequest.classroom;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AssignmentRepository extends JpaRepository<Assignment, UUID> {
    List<Assignment> findByClassroomIdOrderByDueAtAsc(UUID classroomId);
    List<Assignment> findByClassroomIdInOrderByDueAtAsc(List<UUID> classroomIds);
}
