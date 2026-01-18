import requests
import json
import random
import time

# Major Office of Education Codes
OFFICE_CODES = {
    "Seoul": "B10",
    "Busan": "C10",
    "Daegu": "D10",
    "Incheon": "E10",
    "Gwangju": "F10",
    "Daejeon": "G10",
    "Ulsan": "H10",
    "Sejong": "I10",
    "Gyeonggi": "J10",
    "Gangwon": "K10"
}

URL = "https://open.neis.go.kr/hub/schoolInfo"

    schools = []
    
    for region, code in OFFICE_CODES.items():
        print(f"Fetching schools for {region} ({code})...")
        params = {
            "Type": "json",
            "pIndex": 1,
            "pSize": 100, # Get a decent chunk to sample from
            "ATPT_OFCDC_SC_CODE": code,
        }
        
        try:
            response = requests.get(URL, params=params)
            response.raise_for_status()
            data = response.json()
            
            if "schoolInfo" in data:
                rows = data["schoolInfo"][1]["row"]
                
                # Filter for High Schools or just take random mix? Let's take random mix.
                # Just sampling 5 random ones.
                if len(rows) > 5:
                    sampled = random.sample(rows, 5)
                else:
                    sampled = rows
                
                for s in sampled:
                    schools.append({
                        "ATPT_OFCDC_SC_CODE": s.get("ATPT_OFCDC_SC_CODE"),
                        "SD_SCHUL_CODE": s.get("SD_SCHUL_CODE"),
                        "SCHUL_NM": s.get("SCHUL_NM"),
                        "Region": region
                    })
            else:
                print(f"No data found for {region}")
                if "RESULT" in data:
                     print(f"Error: {data['RESULT']['MESSAGE']}")

        except Exception as e:
            print(f"Error fetching {region}: {e}")
            
        time.sleep(0.5) # Be nice to the API

    return schools

if __name__ == "__main__":
    schools_data = fetch_schools()
    with open("schools.json", "w", encoding="utf-8") as f:
        json.dump(schools_data, f, ensure_ascii=False, indent=2)
    
    print(f"Saved {len(schools_data)} schools to schools.json")
