package com.codequest.player;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "players")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Player {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true)
    private String email;

    /**
     * BCrypt password hash. Nullable so legacy (pre-V10) accounts still work;
     * those users are prompted to set a password on next login.
     */
    @Column(name = "password_hash", length = 72)
    private String passwordHash;

    @Column(nullable = false, length = 10)
    private String preferredLanguage = "en"; // UI language: en, sq, etc.

    @Column(nullable = false, length = 50)
    private String programmingLanguage = "Java";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PlayerLevel level = PlayerLevel.BEGINNER;

    @Column(nullable = false)
    private int currentXp = 0;

    @Column(nullable = false)
    private int totalXp = 0;

    @Column(nullable = false)
    private int currentStreak = 0;

    @Column(nullable = false)
    private int longestStreak = 0;

    private LocalDate lastActiveDate;

    /**
     * Whether tutor conversation transcripts are persisted to Postgres for this
     * player. Redis (live session) is unaffected.
     */
    @Column(name = "tutor_messages_opt_in", nullable = false)
    private boolean tutorMessagesOptIn = true;

    @CreationTimestamp
    @Column(updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    // --- Factory ---
    public static Player register(String username, String email, String passwordHash,
                                   String programmingLanguage, PlayerLevel level) {
        Player p = new Player();
        p.username = username;
        p.email = email;
        p.passwordHash = passwordHash;
        p.programmingLanguage = programmingLanguage;
        p.level = level;
        return p;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public boolean hasPassword() {
        return passwordHash != null && !passwordHash.isBlank();
    }

    // --- Behavior ---
    public void awardXp(int xp) {
        if (xp < 0) throw new IllegalArgumentException("XP cannot be negative");
        this.currentXp += xp;
        this.totalXp += xp;
        updateLevel();
    }

    public void updateStreak() {
        LocalDate today = LocalDate.now();
        if (lastActiveDate == null || lastActiveDate.isBefore(today.minusDays(1))) {
            currentStreak = 1;
        } else if (lastActiveDate.isBefore(today)) {
            currentStreak++;
        }
        if (currentStreak > longestStreak) longestStreak = currentStreak;
        lastActiveDate = today;
    }

    public void updateProgrammingLanguage(String lang) {
        this.programmingLanguage = lang;
    }

    public void updateLevel(PlayerLevel level) {
        this.level = level;
    }

    public void setTutorMessagesOptIn(boolean optIn) {
        this.tutorMessagesOptIn = optIn;
    }

    public boolean isNewStreakDay() {
        LocalDate today = LocalDate.now();
        return lastActiveDate == null || lastActiveDate.isBefore(today);
    }

    public int previewNextStreak() {
        LocalDate today = LocalDate.now();
        if (lastActiveDate == null || lastActiveDate.isBefore(today.minusDays(1))) {
            return 1;
        }
        if (lastActiveDate.isBefore(today)) {
            return currentStreak + 1;
        }
        return Math.max(currentStreak, 1);
    }

    private void updateLevel() {
        if (totalXp >= 5000) level = PlayerLevel.MASTER;
        else if (totalXp >= 2000) level = PlayerLevel.SENIOR;
        else if (totalXp >= 500) level = PlayerLevel.INTERMEDIATE;
    }
}
