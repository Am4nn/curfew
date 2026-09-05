-- ===========================================================================
-- 0017  A fine is one posting, not a handful of rows that happen to agree.
--
-- ledger_one_fine_idx is unique on (group, type, period, payer, payee), which
-- makes each SHARE idempotent and the fine as a whole not idempotent at all.
-- A fine is split among the members who passed the same period, so the number
-- of shares depends on who has been scored when the split runs. Settle once
-- with one peer known and the payer owes that peer the whole amount. Settle
-- again with two peers known and the second share inserts beside the first,
-- because no row in the table conflicts with anything. 500 charged as 750, and
-- invariant 7 says shares sum exactly to the fine.
--
-- The accounting answer is that idempotency belongs on the POSTING, so a
-- replay cannot write a second set of entries. This table is that identity:
-- one row per fine, keyed by the thing that caused it. Whoever inserts it owns
-- the split; whoever conflicts leaves the ledger alone.
--
-- It is a guard, not a second copy of the money. ledger_entries stays the
-- record and balances stay a sum over it. `amount` is here so a posting whose
-- shares are missing can still be described, which is what makes that state
-- repairable rather than merely detectable.
--
-- No foreign key to ledger_entries: the shares are many rows and the posting
-- is one, and the direction that matters is enforced by writing the posting
-- first. See writeFines in src/server/ledger.ts.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS fine_postings (
    group_id     uuid        NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    type_key     text        NOT NULL,
    period_start date        NOT NULL,
    from_user_id text        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    amount       bigint      NOT NULL CHECK (amount > 0),
    currency     char(3)     NOT NULL DEFAULT 'INR',
    posted_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, type_key, period_start, from_user_id)
);

-- verify walks postings by group to check the shares sum to the amount.
CREATE INDEX IF NOT EXISTS fine_postings_group_idx
    ON fine_postings (group_id, period_start DESC);

-- Every fine already charged gets its posting, so history is self-consistent
-- and `verify` does not report the whole ledger as unposted.
--
-- The amount is the sum of the shares AS CHARGED, not what the period is owed
-- now. Those are the same number for a fine written correctly, and different
-- for one written by the bug this table exists to stop. Recording what was
-- actually taken is what lets verify say so; writing the recomputed figure
-- here would paper over exactly the case worth finding.
INSERT INTO fine_postings (group_id, type_key, period_start, from_user_id, amount, currency, posted_at)
SELECT group_id, type_key, period_start, from_user_id, SUM(amount), MIN(currency), MIN(created_at)
FROM ledger_entries
WHERE kind = 'fine' AND type_key IS NOT NULL AND period_start IS NOT NULL
GROUP BY group_id, type_key, period_start, from_user_id
ON CONFLICT DO NOTHING;
