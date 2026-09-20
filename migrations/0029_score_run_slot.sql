-- One scoring pass per hour, whatever else happens.
--
-- Scoring moved from a once-a-day Vercel Cron to an hourly QStash schedule,
-- because a single daily firing in UTC cannot serve members in more than one
-- span of timezones: 07:00 UTC is comfortably late in Kolkata and too early in
-- Berlin, where a sleep period shuts at 08:00 UTC and was therefore scored a
-- day late every day.
--
-- Hourly brings back a hazard a daily job did not have. QStash retries a failed
-- delivery three times, so two invocations can overlap, and money is where that
-- is not survivable: a `fine_postings` claim is FINAL, so a run that claims a
-- posting while another is still scoring that period's peers splits the fine
-- among whoever happened to be scored by then, and no later pass can widen it.
-- Invariant 7 says the shares sum to the fine.
--
-- So the pass claims its hour before doing any of it, the same shape
-- events_one_push_idx (0027) gives a reminder tick and fine_postings (0017)
-- gives a fine. Partial, so it costs nothing on the rows that are not this.
--
-- The slot is the UTC hour, "yyyy-MM-ddTHH". Not the member's local hour, which
-- is what a push slot uses: a push is per person and this pass is one global
-- run over everybody.
CREATE UNIQUE INDEX IF NOT EXISTS events_one_score_run_idx
    ON events ((payload->>'slot'))
    WHERE type = 'ops.score.ran';
