# NEIS School Meal Information Agent Guide

## Overview
This document describes how to extract "School Meal Service Diet Information" (급식식단정보) using the NEIS Open API.

## API Information
- **Service Name**: School Meal Service Diet Information (급식식단정보)
- **Endpoint**: `https://open.neis.go.kr/hub/mealServiceDietInfo`
- **Documentation**: [NEIS Open Data Portal](https://open.neis.go.kr/portal/data/service/selectServicePage.do?infId=OPEN17320190722180924242823&infSeq=1)

## Request Parameters

| Parameter | Description | Required | Default | Example |
|-----------|-------------|----------|---------|---------|
| `KEY` | Authentication Key | Yes | - | (Your Issued Key) |
| `Type` | Response Type (json/xml) | Yes | `xml` | `json` |
| `pIndex` | Page Number | Yes | `1` | `1` |
| `pSize` | Page Size | Yes | `100` | `100` |
| `ATPT_OFCDC_SC_CODE` | City/Province Office of Education Code | Yes | - | `B10` (Seoul) |
| `SD_SCHUL_CODE` | Standard School Code | Yes | - | `7010057` |
| `MMEAL_SC_CODE` | Meal Code | No | - | `2` (Lunch) |
| `MLSV_YMD` | Meal Date | No | - | `20240101` |
| `MLSV_FROM_YMD` | Search Start Date | No | - | `20240101` |
| `MLSV_TO_YMD` | Search End Date | No | - | `20240131` |

## Code Example (Python)

```python
import requests
import json

def get_meal_info(office_code, school_code, date=None, api_key=None):
    """
    Fetch school meal information from NEIS Open API.
    
    Args:
        office_code (str): ATPT_OFCDC_SC_CODE (e.g., 'B10')
        school_code (str): SD_SCHUL_CODE (e.g., '7010057')
        date (str, optional): MLSV_YMD (YYYYMMDD). Defaults to None.
        api_key (str, optional): Your NEIS Open API Key. Defaults to None (sample key might be used).
    
    Returns:
        dict: JSON response data or None if error.
    """
    url = "https://open.neis.go.kr/hub/mealServiceDietInfo"
    
    params = {
        "Type": "json",
        "pIndex": 1,
        "pSize": 100,
        "ATPT_OFCDC_SC_CODE": office_code,
        "SD_SCHUL_CODE": school_code,
    }
    
    if api_key:
        params["KEY"] = api_key
        
    if date:
        params["MLSV_YMD"] = date

    try:
        response = requests.get(url, params=params)
        response.raise_for_status() # Raise error for bad status codes
        
        data = response.json()
        
        # Check for API error or result code
        if "mealServiceDietInfo" in data:
            head = data["mealServiceDietInfo"][0]["head"]
            # verify head[1]['RESULT']['CODE'] == 'INFO-000' for success
            return data
        elif "RESULT" in data:
             # Handle error (e.g., INFO-200 No Data)
             print(f"API Result: {data['RESULT']['CODE']} - {data['RESULT']['MESSAGE']}")
             return data
        else:
            print("Unknown response format")
            return data

    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
        return None

if __name__ == "__main__":
    # Example Usage
    # Seoul Office of Education (B10), Seoul High School (Example Code)
    # Note: You need valid codes. 
    # Use 'schoolInfo' API to find codes if needed.
    
    OFFICE_CODE = "B10" 
    SCHOOL_CODE = "7010057" # Example: Gyeonggi Girls' High School
    DATE = "20240401" # YYYYMMDD
    
    # Pass your actual key here if you have one
    meal_data = get_meal_info(OFFICE_CODE, SCHOOL_CODE, DATE)
    
    if meal_data and "mealServiceDietInfo" in meal_data:
        rows = meal_data["mealServiceDietInfo"][1]["row"]
        for row in rows:
            print(f"Date: {row['MLSV_YMD']}")
            print(f"Meal: {row['MMEAL_SC_NM']}")
            print(f"Menu: {row['DDISH_NM']}")
            print("-" * 20)
```

## JSON Response Structure (Example)

```json
{
  "mealServiceDietInfo": [
    {
      "head": [
        {
          "list_total_count": 1
        },
        {
          "RESULT": {
            "CODE": "INFO-000",
            "MESSAGE": "정상 처리되었습니다."
          }
        }
      ]
    },
    {
      "row": [
        {
          "ATPT_OFCDC_SC_CODE": "B10",
          "ATPT_OFCDC_SC_NM": "서울특별시교육청",
          "SD_SCHUL_CODE": "7010057",
          "SCHUL_NM": "경기여고",
          "MMEAL_SC_CODE": "2",
          "MMEAL_SC_NM": "중식",
          "MLSV_YMD": "20240401",
          "MLSV_FGR": "2",
          "DDISH_NM": "현미밥<br/>쇠고기미역국<br/>...",
          "ORPLC_INFO": "쌀 : 국내산<br/>...",
          "CAL_INFO": "750.0 Kcal",
          "NTR_INFO": "탄수화물(g) : 100.0<br/>..."
        }
      ]
    }
  ]
}
```
