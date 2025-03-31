CREATE TABLE IF NOT EXISTS events (
    id bigserial PRIMARY KEY,
    event_id character varying NOT NULL,
    prev_event_id character varying NOT NULL,
    pubkey character varying NOT NULL,
    created_at bigint NOT NULL,
    original character varying NOT NULL,
    "session" character varying NOT NULL,
    mention character varying,

    CONSTRAINT events_unique_event_id
    UNIQUE (event_id),

    CONSTRAINT events_unique_pubkey_session_prev_event_id
    UNIQUE (pubkey, session, prev_event_id)
);
