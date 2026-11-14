# API contract

Fixed. Do not change field names without telling Eman the same day.

Base: FastAPI backend, see `backend/app.py`.

## GET /crew

Returns 4 astronauts with CRI and status.

```json
{
  "crew": [
    {
      "id": "astro-2",
      "name": "Astro 2",
      "cri": 61,
      "status": "amber",
      "sleep": 55,
      "cardio": 60,
      "radiation": 55,
      "exercise": 70,
      "mood": 70,
      "synthetic": true
    }
  ],
  "synthetic": true
}
```

## GET /crew/{id}

Same fields as above, plus `drivers`, a list of plain words for why CRI fell.

Example drivers for Astro 2 on Day 142:
- sleep under 6 hours for 3 nights
- HRV falling from personal baseline
- radiation event yesterday

## GET /alerts

Returns alerts for amber and red crew only.

```json
{
  "alerts": [
    {
      "id": "astro-2",
      "name": "Astro 2",
      "cri": 61,
      "status": "amber",
      "drivers": ["sleep under 6 hours for 3 nights", "radiation event yesterday"],
      "action": "Reschedule the EVA and start the sleep protocol.",
      "synthetic": true
    }
  ],
  "synthetic": true
}
```

## Rules

- CRI = Sleep 25% + Cardio 25% + Radiation 20% + Exercise 15% + Mood 15%.
- Status: 75-100 green, 60-74 amber, below 60 red.
- No diagnosis language. Only risk flag and protocol suggestion.
- All demo data is labelled synthetic.
