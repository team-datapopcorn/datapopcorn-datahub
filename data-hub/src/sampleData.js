export const sampleData = {
  "haerapy_status": [
    {
      "id": "hrp_001",
      "name": "Haerapy Alpha",
      "status": "Active",
      "timestamp": "2024-05-21T10:00:00Z",
      "metrics": {
        "users": 150,
        "revenue": "5,200,000 KRW"
      },
      "owner": "Nathan",
      "notes": "Initial launch phase"
    }
  ],
  "jeju_golf_courses": [
    {
      "id": "jeju_golf_01",
      "name": "Nine Bridges",
      "address": "34-156, Kwangpyong-ro, Seogwipo-si",
      "region": "Seogwipo",
      "hole_count": 18,
      "par": 72,
      "green_fee_weekday": "250,000 KRW",
      "green_fee_weekend": "300,000 KRW",
      "rating": 4.9,
      "contact": "064-793-9999"
    }
  ],
  "ulleungdo_restaurants": [
    {
      "id": "ul_res_01",
      "name": "Ulleung Banjeom",
      "category": "Chinese",
      "menu_signature": ["Mussel Jjamppong", "Squid Tangsuyuk"],
      "price_avg": "12,000 KRW",
      "operating_hours": "11:00 - 20:00",
      "closed_days": "Sunday",
      "rating": 4.3,
      "address": "123, Ulleung-ro",
      "contact": "054-791-1234"
    }
  ],
  "blood_donation": [
    {
      "date": "2024-01-15",
      "type": "Whole Blood 320ml",
      "location": "Gangnam Center",
      "vitals": { "bp": "120/80", "hb": 14.5 }
    }
  ],
  "diet": [
    {
      "timestamp": "2024-05-21T12:30:00",
      "meal_type": "Lunch",
      "foods": ["Kimchi Stew", "Rice"],
      "calories_est": 750
    }
  ],
  "ootd": [
    {
      "timestamp": "2024-05-21T08:15:00",
      "tags": ["Beige Coat", "Jeans"],
      "weather_ref": { "temp": 18.5, "condition": "Sunny" }
    }
  ],
  "environment": [
    {
      "timestamp": "2024-05-21T14:00:00",
      "device_id": "bedroom_sensor_01",
      "temperature": 24.5,
      "humidity": 45.0
    }
  ],
  "health": [
    {
      "date": "2024-05-21",
      "steps": 8540,
      "sleep_score": 85,
      "calories_burned": 2100
    }
  ],
  "finance": [
    {
      "timestamp": "2024-05-21T18:45:00",
      "amount": -15000,
      "currency": "KRW",
      "merchant": "Starbucks",
      "category": "Coffee/Snacks"
    }
  ]
};
