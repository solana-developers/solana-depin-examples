use sea_query::Expr;
use sea_query::Iden;
use sea_query::Order;
use sea_query::PostgresQueryBuilder;
use sea_query::Query;
use sea_query::SimpleExpr;
use sea_query::Value;
use sea_query_binder::SqlxBinder;
use sea_query_binder::SqlxValues;

#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum Error {
    #[error("SQL build error: {0}")]
    SqlBuild(#[from] sea_query::error::Error),
    #[error("SQL execute error: {0}")]
    SqlExecute(#[from] sqlx::Error),
}

#[derive(Iden, Clone, Copy)]
enum ReceivedEvents {
    Id,
    Table,
    EventId,
    CreatedAt,
    IsProcessed,
}

const RECEIVED_EVENT_RECORD_COLUMNS: [ReceivedEvents; 3] = [
    ReceivedEvents::EventId,
    ReceivedEvents::CreatedAt,
    ReceivedEvents::IsProcessed,
];
#[derive(sqlx::FromRow, Debug)]
pub struct ReceivedEventRecord {
    pub event_id: String,
    pub created_at: i64,
    pub is_processed: bool,
}

pub struct State {
    db: sqlx::PgPool,
}

impl State {
    pub fn new(db: sqlx::PgPool) -> Self {
        Self { db }
    }

    pub async fn db_get_last_processed_event(&self) -> Result<Option<ReceivedEventRecord>, Error> {
        let (sql, values) = Query::select()
            .columns(RECEIVED_EVENT_RECORD_COLUMNS)
            .from(ReceivedEvents::Table)
            .and_where(Expr::col(ReceivedEvents::IsProcessed).eq(true))
            // Note: Should not use created_at for sorting.
            // It is not unique and the messages may not be received in the order of creation.
            .order_by(ReceivedEvents::Id, Order::Desc)
            .limit(1)
            .build_sqlx(PostgresQueryBuilder);

        tracing::debug!("will execute: {sql} with {values:?}");

        let row = sqlx::query_as_with::<_, ReceivedEventRecord, _>(&sql, values)
            .fetch_optional(&self.db)
            .await?;

        Ok(row)
    }

    pub async fn db_record_received_event(
        &self,
        event_id: &str,
        created_at: i64,
    ) -> Result<i64, Error> {
        let (sql, values) = Query::insert()
            .into_table(ReceivedEvents::Table)
            .columns([
                ReceivedEvents::EventId,
                ReceivedEvents::CreatedAt,
                ReceivedEvents::IsProcessed,
            ])
            .values(
                [
                    Value::from(event_id),
                    Value::from(created_at),
                    Value::from(false),
                ]
                .map(SimpleExpr::Value),
            )?
            .returning(Query::returning().columns([ReceivedEvents::Id]))
            .build_sqlx(PostgresQueryBuilder);

        let row = sqlx::query_as_with::<_, (i64,), _>(&sql, values)
            .fetch_one(&self.db)
            .await?;

        Ok(row.0)
    }

    // This method is isolated because updating the event to processed may be part of a transaction.
    fn sql_received_event_is_processed(received_id: i64) -> (String, SqlxValues) {
        let (sql, values) = Query::update()
            .table(ReceivedEvents::Table)
            .values([(
                ReceivedEvents::IsProcessed,
                SimpleExpr::Value(Value::from(true)),
            )])
            .and_where(Expr::col(ReceivedEvents::Id).eq(received_id))
            .build_sqlx(PostgresQueryBuilder);
        (sql, values)
    }

    pub async fn db_record_event_processed(&self, received_id: i64) -> Result<(), Error> {
        let (received_sql, received_values) = State::sql_received_event_is_processed(received_id);
        tracing::debug!("will execute: {received_sql} with {received_values:?}");

        sqlx::query_with(&received_sql, received_values)
            .execute(&self.db)
            .await?;

        Ok(())
    }
}
