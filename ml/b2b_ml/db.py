"""MySQL access: read queries into DataFrames, write results in one transaction."""

from contextlib import contextmanager

import pandas as pd
import pymysql

from .config import database_settings


@contextmanager
def connect():
    settings = database_settings()
    connection = pymysql.connect(
        host=settings.host,
        port=settings.port,
        user=settings.user,
        password=settings.password,
        database=settings.name,
        charset="utf8mb4",
        autocommit=False,
    )
    try:
        # Same convention as the API: timestamps are UTC.
        with connection.cursor() as cursor:
            cursor.execute("SET time_zone = '+00:00'")
        yield connection
    finally:
        connection.close()


def read(connection, sql: str, params=None) -> pd.DataFrame:
    with connection.cursor(pymysql.cursors.DictCursor) as cursor:
        cursor.execute(sql, params or ())
        rows = cursor.fetchall()
    return pd.DataFrame(rows)
