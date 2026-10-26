import os

from dotenv import load_dotenv

load_dotenv()


def validate_jwt_secrets(
    secret_key: str | None,
    refresh_secret_key: str | None,
) -> tuple[str, str]:
    if secret_key is None or len(secret_key.encode("utf-8")) < 32:
        raise RuntimeError(
            "SECRET_KEY must be configured with at least 32 bytes of random data."
        )
    if (
        refresh_secret_key is None
        or len(refresh_secret_key.encode("utf-8")) < 32
    ):
        raise RuntimeError(
            "REFRESH_SECRET_KEY must be configured with at least 32 bytes of random data."
        )

    if secret_key == refresh_secret_key:
        raise RuntimeError("SECRET_KEY and REFRESH_SECRET_KEY must be different.")

    return secret_key, refresh_secret_key


JWT_SECRET_KEY, JWT_REFRESH_SECRET_KEY = validate_jwt_secrets(
    os.getenv("SECRET_KEY"),
    os.getenv("REFRESH_SECRET_KEY"),
)
