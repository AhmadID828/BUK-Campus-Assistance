import hashlib
import hmac
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import JWT_SECRET_KEY


def make_rate_limit_key(scope: str, identity: str) -> str:
    value = f"{scope}:{identity}".encode("utf-8")
    return hmac.new(JWT_SECRET_KEY.encode("utf-8"), value, hashlib.sha256).hexdigest()


def enforce_rate_limit(
    db: Session,
    bucket_key: str,
    limit: int,
    window_seconds: int,
) -> None:
    now = datetime.now(timezone.utc)
    if db.get_bind().dialect.name == "sqlite":
        now = now.replace(tzinfo=None)
    cutoff = now - timedelta(seconds=window_seconds)
    retention_cutoff = now - timedelta(days=2)

    db.execute(
        text("DELETE FROM auth_rate_limits WHERE updated_at < :cutoff"),
        {"cutoff": retention_cutoff},
    )

    result = db.execute(
        text(
            """
            INSERT INTO auth_rate_limits
                (bucket_key, window_started_at, request_count, updated_at)
            VALUES
                (:bucket_key, :now, 1, :now)
            ON CONFLICT (bucket_key) DO UPDATE SET
                window_started_at = CASE
                    WHEN auth_rate_limits.window_started_at <= :cutoff
                    THEN excluded.window_started_at
                    ELSE auth_rate_limits.window_started_at
                END,
                request_count = CASE
                    WHEN auth_rate_limits.window_started_at <= :cutoff THEN 1
                    WHEN auth_rate_limits.request_count < :max_count
                    THEN auth_rate_limits.request_count + 1
                    ELSE auth_rate_limits.request_count
                END,
                updated_at = excluded.updated_at
            RETURNING request_count, window_started_at
            """
        ),
        {
            "bucket_key": bucket_key,
            "now": now,
            "cutoff": cutoff,
            "max_count": limit + 1,
        },
    ).one()
    db.commit()

    if result.request_count > limit:
        window_started_at = result.window_started_at
        if isinstance(window_started_at, str):
            window_started_at = datetime.fromisoformat(window_started_at)
        if window_started_at.tzinfo is None:
            window_started_at = window_started_at.replace(tzinfo=timezone.utc)
        retry_now = now
        if retry_now.tzinfo is None:
            retry_now = retry_now.replace(tzinfo=timezone.utc)
        retry_after = max(
            1,
            int(
                (
                    window_started_at
                    + timedelta(seconds=window_seconds)
                    - retry_now
                ).total_seconds()
            ),
        )
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )


def clear_rate_limit(db: Session, bucket_key: str) -> None:
    db.execute(
        text("DELETE FROM auth_rate_limits WHERE bucket_key = :bucket_key"),
        {"bucket_key": bucket_key},
    )
    db.commit()
