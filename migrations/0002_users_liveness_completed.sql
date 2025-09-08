-- D1 migration: add liveness_completed flag to users
ALTER TABLE users ADD COLUMN liveness_completed INTEGER NOT NULL DEFAULT 0;

