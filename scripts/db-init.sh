#!/bin/bash

# Start a PostgreSQL 17 container named 'postgresql' (no --rm, detached)
docker run -d \
  --name postgresql \
  -e POSTGRES_USER=black_ace \
  -e POSTGRES_PASSWORD=p3xJ0sarS46sq \
  -e POSTGRES_DB=testdb \
  -p 5432:5432 \
  postgres:17

# Wait for PostgreSQL to be ready
until docker exec postgresql pg_isready -U black_ace; do
  echo "Waiting for PostgreSQL to start..."
  sleep 2
done

echo "PostgreSQL container is up. Running init scripts..."

# Example: Run SQL scripts from ./database/init.sql (modify as needed)
docker exec -i postgresql psql -U black_ace -d testdb < ./database/init.sql
docker exec -i postgresql psql -U black_ace -d testdb < ./database/chat.sql
docker exec -i postgresql psql -U black_ace -d testdb < ./database/pokemon.sql
docker exec -i postgresql psql -U black_ace -d testdb < ./database/pokemon_team.sql
docker exec -i postgresql psql -U black_ace -d testdb < ./database/rag_data.sql
docker exec -i postgresql psql -U black_ace -d testdb < ./database/rag_staging.sql
docker exec -i postgresql psql -U black_ace -d testdb < ./database/test_case.sql
docker exec -i postgresql psql -U black_ace -d testdb < ./database/persona.sql
docker exec -i postgresql psql -U black_ace -d testdb < ./database/latest.sql
docker exec -i postgresql psql -U black_ace -d testdb < ./database/migrations/2026_01_28_trace_analysis_tables.sql
docker exec -i postgresql psql -U black_ace -d testdb < ./database/migrations/2026_01_28_test_run_drift_tracking.sql

echo "Database initialization complete."
