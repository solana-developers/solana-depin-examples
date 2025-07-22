#!/bin/bash
set -e

export PGPASSWORD="dephy"

psql -U dephy -c "CREATE DATABASE dephy_messaging_network;"
psql -U dephy -c "CREATE DATABASE dephy_decharge_controller_server;"

for sql_file in /messaging_network_migrations/*.sql; do
  echo "Executing $sql_file..."
  psql -U dephy -d dephy_messaging_network -f "$sql_file"
done

for sql_file in /decharge_controller_server_migrations/*.sql; do
  echo "Executing $sql_file..."
  psql -U dephy -d dephy_decharge_controller_server -f "$sql_file"
done
