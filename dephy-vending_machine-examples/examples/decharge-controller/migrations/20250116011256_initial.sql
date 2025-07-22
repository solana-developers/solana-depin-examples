CREATE TABLE IF NOT EXISTS received_events (
    id bigserial PRIMARY KEY,
    event_id character varying NOT NULL,
    created_at bigint NOT NULL,
    is_processed boolean NOT NULL
);
