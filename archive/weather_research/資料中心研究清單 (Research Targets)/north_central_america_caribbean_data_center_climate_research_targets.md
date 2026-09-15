# North, Central America & Caribbean Data Center Climate Research Targets

## Purpose

This file converts the supplied Uptime Institute award dataset for **WMO Region 4 — North & Central America + Caribbean** into a controlled climate-data collection target list.

It is intentionally **not a census of every data center**.

The source notes that the Uptime registry only captures facilities that formally received Uptime Institute Tier III/IV awards; a country with zero awards is therefore not proof that it has no Tier III-equivalent infrastructure. The supplied source also identifies the United States as incomplete because its award population is too large for a simple spot-check. fileciteturn2file0L3-L7 fileciteturn2file0L13-L29

The objective is to collect the **smallest practical set of representative climate locations** needed for:

- Data-center HVAC design
- Chiller / Dry Cooler / Cooling Tower studies
- CDU / PHE / liquid-cooling studies
- Hydronic system design
- Outdoor-air design conditions
- EPW / TMY / TMYx weather data
- DB / WB / RH / dew point
- Cooling and heat-rejection engineering
- Future HydroPuzzle Pro project climate selection

---

# 1. Recommended Structure for the Americas

Do **not** make one enormous "Americas" weather dataset.

For practical research, divide the Americas into:

```text
AMERICAS
│
├── WMO Region 4
│   ├── North America
│   ├── Central America
│   └── Caribbean
│
└── South America
    └── WMO Region 3
```

This file covers **WMO Region 4**.

South America should be handled as a **separate MD / research batch** because its climate range is large enough to justify its own selection.

---

# 2. Core Research Locations — P0

**Collect these first.**

Target: **14 representative locations**

The selection is based on:

1. Major data-center market importance
2. Climate diversity
3. Cooling-system engineering relevance
4. Geographic coverage
5. Avoiding unnecessary duplication

| ID | Market | Representative City / Area | Climate / Engineering Role | Priority |
|---|---|---|---|---|
| 01 | United States | Northern Virginia / Ashburn | Major hyperscale DC hub; humid subtropical / Mid-Atlantic | P0 |
| 02 | United States | Dallas–Fort Worth | Hot summer; major inland DC market | P0 |
| 03 | United States | Phoenix | Extreme hot/dry cooling-design condition | P0 |
| 04 | United States | Chicago | Cold winter + warm summer; strong seasonal contrast | P0 |
| 05 | United States | Silicon Valley / San Francisco Bay Area | Mild coastal California climate; major technology market | P0 |
| 06 | Canada | Toronto / Mississauga | Major Canadian DC market; cold winter / warm summer | P0 |
| 07 | Canada | Montreal | Colder eastern Canadian climate; strong free-cooling contrast | P0 |
| 08 | Canada | Vancouver | Mild, wet Pacific maritime climate | P0 |
| 09 | Mexico | Querétaro | Major Mexican DC cluster; highland semi-arid climate | P0 |
| 10 | Mexico | Mexico City | High-altitude subtropical climate | P0 |
| 11 | Mexico | Monterrey | Hot, relatively dry northern Mexico | P0 |
| 12 | Guatemala | Guatemala City | Tropical highland climate | P0 |
| 13 | Costa Rica | San José | Tropical highland climate | P0 |
| 14 | Panama | Panama City | Hot/humid tropical lowland climate | P0 |

## Why these 14

The supplied source shows very large award populations in the United States, substantial coverage in Canada and Mexico, and multiple awarded facilities in Guatemala, Costa Rica and Panama. fileciteturn2file0L13-L29 fileciteturn2file0L31-L72 fileciteturn2file0L74-L107 fileciteturn2file0L113-L160

The United States is intentionally represented by **five climate/market zones instead of trying to collect every state**.

---

# 3. P0 United States Strategy

The supplied source explicitly states that the US contains **350+ awarded facilities** and that the listed facilities are only a sample. It recommends checking major hubs such as Northern Virginia, Dallas–Fort Worth, Phoenix, Chicago, Silicon Valley, Atlanta, Northern New Jersey and Hillsboro. fileciteturn2file0L13-L29

Therefore, do NOT attempt to build a weather dataset for all US award facilities.

Use these P0 representative locations:

### US-01 — Northern Virginia / Ashburn

Represents:

- Northern Virginia hyperscale cluster
- Mid-Atlantic
- Humid summer
- Cool winter

### US-02 — Dallas–Fort Worth

Represents:

- Texas data-center market
- Very hot summer
- Inland climate

### US-03 — Phoenix

Represents:

- Extreme hot/dry condition
- High cooling load
- Dry-cooler / heat-rejection comparison

### US-04 — Chicago

Represents:

- Cold winter
- Warm/humid summer
- Strong seasonal variation

### US-05 — Silicon Valley / Bay Area

Represents:

- Mild coastal California
- Technology / data-center market
- Strong contrast with Phoenix

---

# 4. Expansion Research Locations — P1

Only collect these after P0 is complete.

Target: **14 additional locations**

| ID | Market | Representative City / Area | Reason |
|---|---|---|---|
| P1-01 | United States | Atlanta | Hot/humid southeastern US |
| P1-02 | United States | Northern New Jersey / NYC metro | Major northeastern DC market |
| P1-03 | United States | Hillsboro / Portland OR | Pacific Northwest climate |
| P1-04 | United States | Denver | High-altitude semi-arid climate |
| P1-05 | United States | Miami | Hot/humid subtropical extreme |
| P1-06 | Canada | Calgary | Cold/dry continental climate |
| P1-07 | Canada | Edmonton | Very cold continental climate |
| P1-08 | Canada | Ottawa | Cold eastern Canadian climate |
| P1-09 | Canada | Halifax | Maritime Atlantic Canada |
| P1-10 | Mexico | Guadalajara | Mexican highland / warm climate |
| P1-11 | Mexico | Monterrey | Northern Mexico; hot/dry |
| P1-12 | Dominican Republic | Santo Domingo | Tropical Caribbean |
| P1-13 | Jamaica | Kingston / St. Catherine | Tropical Caribbean |
| P1-14 | Trinidad & Tobago | Port of Spain | Tropical maritime Caribbean |

The source confirms multiple awarded facilities in the Dominican Republic, Jamaica, Trinidad & Tobago and Puerto Rico. fileciteturn2file0L193-L223

---

# 5. Central America — Scope Decision

The source contains meaningful Uptime-awarded facility populations in:

- Guatemala
- Costa Rica
- Panama
- Honduras
- El Salvador
- Nicaragua

fileciteturn2file0L111-L187

However, it is unnecessary to make a separate climate dataset for every one of these countries in the first pass.

Use:

```text
Guatemala City
    → Central American highland

San José
    → Tropical highland

Panama City
    → Tropical lowland / hot-humid
```

These three locations provide much more useful climate coverage than collecting every Central American country individually.

Honduras, El Salvador and Nicaragua remain **P2 / on-demand** for now.

---

# 6. Caribbean — Scope Decision

Do not build a weather dataset for every island.

Use:

### P0 / P1 representative locations

```text
Panama City
        ↓
Central America tropical lowland

Santo Domingo
        ↓
Caribbean tropical

Kingston
        ↓
Caribbean tropical / maritime

Port of Spain
        ↓
Southern Caribbean tropical
```

Puerto Rico can be added when a project specifically requires US-territory / Caribbean engineering coverage.

The source identifies awarded facilities in the Dominican Republic, Jamaica, Trinidad & Tobago and Puerto Rico. fileciteturn2file0L193-L223

---

# 7. P2 / On-Demand Markets

Do not collect these automatically during the first pass.

Examples:

### Central America

- Honduras
- El Salvador
- Nicaragua
- Belize

### Caribbean

- Cuba
- Bahamas
- Bermuda
- Haiti
- Barbados
- Aruba
- Curaçao
- Sint Maarten
- Cayman Islands
- Turks & Caicos
- US / British Virgin Islands
- Guadeloupe
- Martinique
- Dominica
- Grenada
- Saint Lucia
- Saint Kitts and Nevis
- Saint Vincent and the Grenadines
- Antigua and Barbuda
- Anguilla
- Montserrat
- Saint Barthélemy
- Saint Martin

The source itself lists several zero-award markets and states that many smaller islands were not individually checked. fileciteturn2file0L225-L226

**P2 does not mean "no data center".**

It means:

> No dedicated climate dataset is required for the current first-pass engineering scope.

---

# 8. Important Rule: Do Not Use Uptime Count as the Number of Weather Files

Example:

```text
350+ US awarded facilities
        ↓
5 P0 representative climate locations
```

```text
30+ Canadian facilities
        ↓
3 P0 representative climate locations
```

```text
30+ Mexican facilities
        ↓
3 P0 representative climate locations
```

This is the intended compression strategy.

The climate dataset should scale with:

```text
Climate Diversity
+
Engineering Relevance
+
Data Center Market Importance
```

not:

```text
Number of Data Centers
```

---

# 9. Required Weather Data Per Location

For every P0/P1 location, collect where available:

## Geographic

- Country
- City
- Latitude
- Longitude
- Elevation
- WMO station ID
- Representative weather station
- Station distance from city

## Temperature

- Annual average DB
- Monthly average DB
- Monthly maximum DB
- Monthly minimum DB
- Cooling design DB
- Heating design DB
- Peak summer DB
- Extreme DB

## Moisture

- Relative humidity
- Wet-bulb temperature
- Dew-point temperature
- Humidity ratio
- Vapor pressure

## Environmental

- Wind speed
- Wind direction
- Atmospheric pressure
- Solar radiation, where available

## Time-series

Preferred:

1. EPW
2. TMY / TMYx
3. Hourly historical station data
4. Official meteorological data

---

# 10. Engineering Design Data

Where available:

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

Never invent missing engineering values.

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

# 11. Recommended Source Priority

### Priority A

- National meteorological agencies
- WMO
- Official weather stations
- Official airport weather observations
- ASHRAE climate data
- Government open-data portals

### Priority B

- OneBuilding
- TMY / TMYx
- EnergyPlus weather files
- Established building-energy weather datasets

### Priority C

Secondary sources only when primary / engineering-grade data is unavailable.

---

# 12. OneBuilding / EPW Strategy

For every target city:

```text
Representative City
        ↓
Find suitable WMO / weather station
        ↓
Check WMO Region 4
        ↓
Select EPW / TMY / TMYx
        ↓
Record station metadata
        ↓
Store climate dataset
```

Do not download every weather station in the US, Canada or Mexico.

Prefer:

> **one representative station per target city / climate zone**

unless engineering requirements justify additional stations.

---

# 13. HydroPuzzle Pro Integration

The final dataset should support:

```text
Project
 └── Location
      ├── Country
      ├── Region
      ├── City
      ├── Latitude
      ├── Longitude
      ├── Elevation
      ├── Weather Source
      ├── Weather File
      ├── WMO Station
      ├── Design DB
      ├── Design WB
      ├── Design RH
      ├── Dew Point
      └── Climate Classification
```

Example:

```text
United States
└── Phoenix
    ├── Weather: EPW / TMYx
    ├── WMO Station
    ├── Design DB
    ├── Design WB
    ├── RH
    ├── Dew Point
    └── Climate Classification
```

HydroPuzzle Pro can then select the climate dataset from the project location.

---

# 14. Research Order

## Phase 1 — P0

### North America

1. Northern Virginia / Ashburn
2. Dallas–Fort Worth
3. Phoenix
4. Chicago
5. Silicon Valley / Bay Area
6. Toronto / Mississauga
7. Montreal
8. Vancouver
9. Querétaro
10. Mexico City
11. Monterrey

### Central America

12. Guatemala City
13. San José
14. Panama City

## Phase 2 — P1

Collect the 14 expansion locations.

## Phase 3 — P2

Only collect when required by:

- A real project
- A customer location
- A regional engineering study
- A HydroPuzzle Pro requirement

---

# 15. Target Dataset Size

Recommended first-pass scope:

```text
P0 Core:
14 locations

P1 Expansion:
14 locations

P2:
On-demand only
```

Total planned first-pass coverage:

```text
28 locations
```

This is intentionally much smaller than the number of Uptime-awarded facilities.

---

# 16. Status Tracking Template

| Location | Weather Source | Station | EPW/TMY | DB | WB | RH | Dew Point | Design Data | Status |
|---|---|---|---|---|---|---|---|---|---|
| Ashburn / Northern Virginia | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Dallas–Fort Worth | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Phoenix | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Chicago | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Silicon Valley | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Toronto / Mississauga | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Montreal | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Vancouver | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Querétaro | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Mexico City | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Monterrey | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Guatemala City | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| San José | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Panama City | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |

---

# 17. Final Scope Rule

Do NOT turn this into:

> "Find every Tier III / Tier IV data center in the Americas."

That is a separate registry project.

The purpose of this dataset is:

> **Build a compact, engineering-useful climate dataset for data-center HVAC and hydronic design.**

For WMO Region 4, start with **14 P0 locations**.

Do not begin P1 until all P0 locations have:

- Verified weather source
- Representative station
- EPW/TMY/TMYx where available
- DB/WB/RH data
- Source metadata
- Engineering design-condition fields

---

# 18. Important Boundary: South America

This file intentionally does **not** include South America.

South America should be handled as a separate research batch because:

- Brazil alone contains multiple distinct climate zones and major DC markets
- Southern Cone climates are substantially different from tropical South America
- Andean cities introduce major elevation effects
- One "Americas" list would become unnecessarily large

Recommended next structure:

```text
Americas
│
├── WMO Region 4
│   └── This file
│
└── WMO Region 3
    └── South America — separate MD
```

This keeps each research batch manageable.
