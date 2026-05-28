package com.codequest.progression;

import com.codequest.challenge.PracticeMode;
import com.codequest.player.PlayerLevel;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "progression_nodes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProgressionNode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 120)
    private String topic;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PlayerLevel difficulty;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PracticeMode practiceMode = PracticeMode.BUG_HUNT;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String learningObjective;

    @Column(nullable = false)
    private int xpReward;

    @Column(nullable = false, unique = true)
    private int orderIndex;

    @CreationTimestamp
    @Column(updatable = false)
    private Instant createdAt;

    public static ProgressionNode create(
            String title,
            String topic,
            PlayerLevel difficulty,
            PracticeMode practiceMode,
            String learningObjective,
            int xpReward,
            int orderIndex
    ) {
        ProgressionNode node = new ProgressionNode();
        node.title = title;
        node.topic = topic;
        node.difficulty = difficulty;
        node.practiceMode = practiceMode;
        node.learningObjective = learningObjective;
        node.xpReward = xpReward;
        node.orderIndex = orderIndex;
        return node;
    }
}

