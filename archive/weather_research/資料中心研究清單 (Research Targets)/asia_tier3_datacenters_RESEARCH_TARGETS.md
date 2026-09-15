# Asia Data Center Climate Research Targets

## Purpose

This file defines the **target locations to collect weather / climate data for data-center HVAC engineering research**.

It is intentionally **not a census of every Asian data center**. The Uptime Institute award registry is used only as evidence that data-center markets exist; it is not the unit of data collection.

The objective is to reduce the research workload while retaining representative climates and major data-center markets relevant to:

- Data-center HVAC design
- Chiller / Dry Cooler / Cooling Tower analysis
- CDU / PHE / liquid-cooling studies
- Hydronic system design
- Design outdoor-air conditions
- TMY / EPW weather data
- DB / WB / RH / dew point
- Cooling design conditions
- Future HydroPuzzle Pro project climate selection

---

# 1. Core Research Locations — P0

**These locations should be collected first and treated as the official core climate dataset.**

Target: **12 representative locations**

| ID | Country / Market | Representative City | Climate / Engineering Role | Priority |
|---|---|---|---|---|
| 01 | Japan | Tokyo | Humid temperate; hot/humid summer + cool winter | P0 |
| 02 | South Korea | Seoul | Strong seasonal variation; cold winter | P0 |
| 03 | Taiwan | Taoyuan / Taipei | Hot, humid subtropical; important Taiwan DC market | P0 |
| 04 | China | Shanghai | Humid subtropical; major East China DC market | P0 |
| 05 | China | Beijing | Continental; hot summer + cold/dry winter | P0 |
| 06 | China | Shenzhen | Hot/humid subtropical; South China DC market | P0 |
| 07 | Singapore | Singapore | Equatorial hot/humid climate | P0 |
| 08 | Indonesia | Jakarta | Tropical hot/humid climate | P0 |
| 09 | Thailand | Bangkok | Tropical monsoon; hot/humid | P0 |
| 10 | India | Mumbai | Hot/humid + monsoon influence | P0 |
| 11 | United Arab Emirates | Dubai | Extreme hot/dry climate | P0 |
| 12 | Saudi Arabia | Riyadh | Extreme hot/dry continental climate | P0 |

## P0 rule

For each P0 location, collect **one representative weather dataset first**.

Do NOT collect every data center in the city.

The city is the climate-data key.

Example:

```text
Taoyuan
  -> Weather Station / TMY
  -> Design DB
  -> Design WB
  -> RH
  -> Dew Point
  -> Monthly / Annual climate
  -> HVAC design inputs
```

---

# 2. Expansion Research Locations — P1

These locations should be collected **after all P0 locations are complete**.

Target: approximately **20–25 additional representative locations**.

| ID | Market | Representative City / Area | Reason |
|---|---|---|---|
| P1-01 | Japan | Osaka | Western Japan / separate climate representation |
| P1-02 | Japan | Inzai / Chiba | Major Tokyo-area DC cluster |
| P1-03 | South Korea | Busan | Southern coastal Korea |
| P1-04 | Hong Kong | Hong Kong | Dense subtropical coastal DC market |
| P1-05 | Malaysia | Kuala Lumpur | Tropical DC market |
| P1-06 | Malaysia | Johor | Major hyperscale / Singapore-linked DC market |
| P1-07 | Vietnam | Hanoi | Northern Vietnam; seasonal climate |
| P1-08 | Vietnam | Ho Chi Minh City | Southern tropical climate |
| P1-09 | Philippines | Manila | Tropical maritime climate |
| P1-10 | India | Chennai | Hot/humid coastal India |
| P1-11 | India | Hyderabad | Inland Indian DC market |
| P1-12 | India | Delhi / NCR | Hot summer + cooler winter |
| P1-13 | Australia | Sydney | Southern hemisphere temperate DC market |
| P1-14 | Australia | Melbourne | Cooler southern climate |
| P1-15 | UAE | Abu Dhabi | Gulf coastal extreme heat/humidity |
| P1-16 | Saudi Arabia | Jeddah | Hot coastal Saudi climate |
| P1-17 | Pakistan | Karachi | Hot coastal / semi-arid climate |
| P1-18 | Bangladesh | Dhaka | Hot/humid monsoon climate |
| P1-19 | Sri Lanka | Colombo | Tropical maritime climate |
| P1-20 | Cambodia | Phnom Penh | Tropical monsoon climate |
| P1-21 | Kazakhstan | Almaty | Continental climate; cold winter |
| P1-22 | Kazakhstan | Astana | Extreme continental / cold winter |
| P1-23 | Uzbekistan | Tashkent | Hot dry summer + cold winter |
| P1-24 | Azerbaijan | Baku | Semi-arid / Caspian climate |
| P1-25 | Georgia | Tbilisi | Transitional continental climate |

---

# 3. Do Not Collect Automatically — P2 / On Demand

The following markets may have data centers or Uptime Institute awards, but **should not be collected as part of the first-pass weather dataset**.

Only add them when a real project, customer requirement, or engineering study requires them.

Examples:

- Armenia
- Mongolia
- Myanmar
- Laos
- Bhutan
- Nepal
- Maldives
- North Korea
- Kyrgyzstan
- Tajikistan
- Turkmenistan
- Iran
- Iraq
- Kuwait
- Oman
- Bahrain
- Jordan
- Lebanon
- Yemen
- Afghanistan
- British Indian Ocean Territory
- Macau

**Important:** P2 does NOT mean "no data center".

It means:

> No first-pass climate dataset is required for the current research scope.

---

# 4. Data Collection Rule

The research unit is:

```text
CLIMATE LOCATION
```

NOT:

```text
INDIVIDUAL DATA CENTER
```

Therefore:

```text
100 data centers in Shanghai
        ↓
1 Shanghai climate dataset
```

and:

```text
50 data centers around Tokyo
        ↓
Tokyo + Inzai/Chiba representative datasets
```

This prevents the weather-data project from expanding proportionally with the number of data centers.

---

# 5. Required Weather Data Per Location

For every P0/P1 location, attempt to collect the following.

## A. Basic geographic data

- Country
- City
- Latitude
- Longitude
- Elevation
- WMO station ID, if available
- Representative weather station
- Distance from representative city to station

## B. Temperature

- Annual average DB temperature
- Monthly average DB
- Monthly maximum DB
- Monthly minimum DB
- Design summer DB
- Design winter DB
- Extreme DB, where available

## C. Moisture

- Relative humidity
- Wet-bulb temperature
- Dew-point temperature
- Humidity ratio
- Vapor pressure, where available

## D. Solar / environmental data

Where available:

- Global horizontal irradiance
- Direct normal irradiance
- Diffuse radiation
- Wind speed
- Wind direction
- Atmospheric pressure

## E. Time-series weather

Preferred:

1. EPW
2. TMY / TMYx
3. Hourly historical weather
4. Official meteorological station data

---

# 6. Engineering Design Data

Where available, convert the weather data into engineering-useful values.

Recommended fields:

```text
Cooling Design DB
Cooling Design WB
Cooling Design RH
Cooling Design Dew Point
Heating Design DB
Peak Summer DB
Peak Summer WB
Annual Mean DB
Annual Mean RH
Design Wind Speed
Design Atmospheric Pressure
```

Do not invent values when the source does not provide them.

Store:

```text
value
unit
source
source_date
station
method
```

---

# 7. Recommended Source Priority

Use sources in this order where possible:

### Priority A — Official / engineering-grade

- National meteorological agencies
- WMO
- Official airport / weather station records
- ASHRAE climate data
- Government open-data portals

### Priority B — Engineering weather databases

- OneBuilding / TMY / TMYx
- EnergyPlus weather files
- Other established building-energy weather datasets

### Priority C — Secondary sources

Only use when primary data is unavailable.

Every imported dataset should record its source.

---

# 8. OneBuilding / EPW Strategy

For each target city:

```text
City
 ↓
Find nearest suitable WMO / weather station
 ↓
Check OneBuilding WMO Region 2
 ↓
Select TMY / TMYx / EPW
 ↓
Record station metadata
 ↓
Store weather dataset
```

Do not download every weather station in a country.

Prefer:

> **one representative station per target city / climate zone**

unless engineering requirements justify additional stations.

---

# 9. HydroPuzzle Pro Integration

The final data structure should eventually support:

```text
Project
 └── Location
      ├── Country
      ├── City
      ├── Latitude
      ├── Longitude
      ├── Elevation
      ├── Weather Source
      ├── Weather File
      ├── Design DB
      ├── Design WB
      ├── Design RH
      ├── Dew Point
      └── Climate Classification
```

Example:

```text
Taiwan
└── Taoyuan
    ├── Weather: EPW / TMYx
    ├── Design DB
    ├── Design WB
    ├── RH
    ├── Dew Point
    └── Station Metadata
```

This allows HydroPuzzle Pro to select climate data by project location rather than by individual data-center record.

---

# 10. Research Order

Follow this order.

## Phase 1 — P0

1. Tokyo
2. Seoul
3. Taoyuan / Taipei
4. Shanghai
5. Beijing
6. Shenzhen
7. Singapore
8. Jakarta
9. Bangkok
10. Mumbai
11. Dubai
12. Riyadh

## Phase 2 — P1

Collect the approximately 20–25 expansion locations listed above.

## Phase 3 — P2

Do NOT collect unless a specific project requires the location.

---

# 11. Important Scope Control

Do NOT turn this project into:

> "Find every Tier III / Tier IV data center in Asia."

That is a separate database project.

The purpose of this dataset is:

> **Build a compact, engineering-useful Asian climate dataset for data-center HVAC and hydronic design.**

Uptime Institute award records can be used to identify important data-center markets, but the climate database should remain independent from the complete Uptime registry.

---

# 12. Target Dataset Size

Recommended final scope:

```text
P0 Core:
12 locations

P1 Expansion:
20–25 locations

P2 On-demand:
unlimited, but only when required
```

### Recommended first milestone

**12 locations only.**

Do not start P1 until all P0 locations have:

- verified weather source
- representative station
- EPW/TMY/TMYx where available
- DB/WB/RH data
- source metadata
- engineering design-condition fields

This keeps the initial data-collection workload controlled and produces a usable engineering dataset quickly.

---

# 13. Status Tracking Template

Use this structure when collecting data:

| Location | Weather Source | Station | EPW/TMY | DB | WB | RH | Dew Point | Design Data | Status |
|---|---|---|---|---|---|---|---|---|---|
| Tokyo | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Seoul | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Taoyuan | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Shanghai | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Beijing | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Shenzhen | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Singapore | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Jakarta | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Bangkok | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Mumbai | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Dubai | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Riyadh | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |

---

## Final Rule

**Start with 12.**

Do not expand the list until the 12 P0 locations are complete.

The goal is not to collect the most data.

The goal is to collect the **smallest set of climate locations that provides useful coverage for Asian data-center HVAC engineering.**
