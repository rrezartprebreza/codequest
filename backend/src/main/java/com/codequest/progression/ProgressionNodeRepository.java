package com.codequest.progression;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ProgressionNodeRepository extends JpaRepository<ProgressionNode, UUID> {
    List<ProgressionNode> findAllByOrderByOrderIndexAsc();
}

