package com.codequest.auth;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

/**
 * Helpers for resolving the authenticated player from Spring SecurityContext.
 * Use these instead of trusting client-provided playerIds on sensitive endpoints.
 */
public final class AuthUtils {

    private AuthUtils() {}

    /** Returns the playerId of the authenticated user, or null when unauthenticated. */
    public static UUID currentPlayerId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        Object principal = auth.getPrincipal();
        return principal instanceof UUID uuid ? uuid : null;
    }

    /** Returns the current playerId or throws if unauthenticated. */
    public static UUID requireCurrentPlayerId() {
        UUID id = currentPlayerId();
        if (id == null) {
            throw new AccessDeniedException("Authentication required.");
        }
        return id;
    }

    /**
     * Throws 403 if the supplied playerId is not the authenticated user.
     * Use on every endpoint that takes a playerId in path or body so a valid
     * token cannot be used to act on another user's data.
     */
    public static void requireSelfOrThrow(UUID requestedPlayerId) {
        UUID me = requireCurrentPlayerId();
        if (!me.equals(requestedPlayerId)) {
            throw new AccessDeniedException("Action restricted to the authenticated user.");
        }
    }
}
