package com.codequest.leaderboard;

public enum League {
    BRONZE,
    SILVER,
    GOLD,
    PLATINUM,
    DIAMOND;

    public static League fromTotalXp(int totalXp) {
        if (totalXp >= 5000) return DIAMOND;
        if (totalXp >= 2500) return PLATINUM;
        if (totalXp >= 1200) return GOLD;
        if (totalXp >= 400) return SILVER;
        return BRONZE;
    }
}
