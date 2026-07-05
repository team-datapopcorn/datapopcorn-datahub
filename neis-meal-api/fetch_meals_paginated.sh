#!/bin/bash

# =================================================================
# NEIS Meal API Paginated Fetcher (cURL version)
# =================================================================

# 1. API Configuration
URL="https://open.neis.go.kr/hub/mealServiceDietInfo"
KEY="sample" # Replace with your real API Key
TYPE="json"
PSIZE=100

# 2. TARGET: Garak High School (Example from our schools.json)
OFFICE_CODE="B10" # Seoul
SCHOOL_CODE="7010057" # Garak High School

# 3. Initialization
PINDEX=1
TOTAL_RECORDS=0
OUTPUT_FILE="meals_all_pages.json"

echo "=== Starting Paginated Fetch for School: $SCHOOL_CODE ==="
echo "Note: Using sample key. Data might be limited."

# Create/Clear output file
echo "[" > "$OUTPUT_FILE"

while true; do
  echo ">>> Fetching page $PINDEX (pSize: $PSIZE)..."
  
  # Fetch data using curl
  RESPONSE=$(curl -s -G "$URL" \
    --data-urlencode "KEY=$KEY" \
    --data-urlencode "Type=$TYPE" \
    --data-urlencode "pIndex=$PINDEX" \
    --data-urlencode "pSize=$PSIZE" \
    --data-urlencode "ATPT_OFCDC_SC_CODE=$OFFICE_CODE" \
    --data-urlencode "SD_SCHUL_CODE=$SCHOOL_CODE")

  # Extract total count on page 1
  if [ "$PINDEX" -eq 1 ]; then
    TOTAL_RECORDS=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['mealServiceDietInfo'][0]['head'][0]['list_total_count'] if 'mealServiceDietInfo' in data else 0)")
    echo "Total records to fetch: $TOTAL_RECORDS"
    
    if [ "$TOTAL_RECORDS" -eq 0 ]; then
      echo "No data found or Error occurred."
      echo "$RESPONSE"
      break
    fi
  fi

  # Extract the 'row' data
  # We use python3 to extract the rows for robustness
  ROWS=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(json.dumps(data['mealServiceDietInfo'][1]['row'], ensure_ascii=False) if 'mealServiceDietInfo' in data else '[]')")
  
  # Check if rows are empty
  if [ "$ROWS" == "[]" ]; then
    echo "No more data returned."
    break
  fi

  # Append rows to our output file (cleaning up the brackets for valid JSON array merge)
  if [ "$PINDEX" -gt 1 ]; then
    echo "," >> "$OUTPUT_FILE"
  fi
  echo "${ROWS:1:-1}" >> "$OUTPUT_FILE"

  # Check if we've reached the end
  MAX_PAGE=$(( (TOTAL_RECORDS + PSIZE - 1) / PSIZE ))
  if [ "$PINDEX" -ge "$MAX_PAGE" ]; then
    break
  fi

  ((PINDEX++))
  
  # API Rate Limiting (Be nice)
  sleep 0.5
done

echo "]" >> "$OUTPUT_FILE"
echo "=== Fetch Completed! ==="
echo "Total records saved to $OUTPUT_FILE"
