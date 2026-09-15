# Europe Data Center Climate Research Targets

## Purpose

This file converts the original Europe Uptime Institute data-center list into a **controlled climate-data collection target list**.

It is intentionally **not a census of every European data center**.

The source file is based on the Uptime Institute public awards database and notes that its list only captures facilities with formal Uptime Tier III/IV awards; a country with zero Uptime awards does **not** mean that the country has no Tier III-equivalent or hyperscale data-center infrastructure. fileciteturn1file0L3-L7

The objective here is to collect the **smallest practical set of representative European climate locations** needed for data-center HVAC / hydronic engineering.

The research unit is:

```text
CLIMATE LOCATION
```

not:

```text
INDIVIDUAL DATA CENTER
```

---

# 1. Core Research Locations — P0

**Collect these first.**

Target: **16 representative European locations**

These locations are selected to cover:

- Major European data-center markets
- Western / Central / Northern / Southern Europe
- Oceanic climates
- Continental climates
- Cold Nordic climates
- Mediterranean climates
- Hot continental / semi-arid edge conditions
- Major data-center clusters appearing in the source dataset

| ID | Market | Representative City | Climate / Engineering Role | Priority |
|---|---|---|---|---|
| 01 | United Kingdom | London | Oceanic; major European DC market; mild winter / humid summer | P0 |
| 02 | Ireland | Dublin | Cool maritime / oceanic; major hyperscale market | P0 |
| 03 | Netherlands | Amsterdam | Cool maritime; major European DC hub | P0 |
| 04 | Germany | Frankfurt | Central European continental/oceanic transition; major DC hub | P0 |
| 05 | France | Paris | Temperate oceanic/continental transition; major French DC market | P0 |
| 06 | Switzerland | Zurich | Inland temperate; elevation and winter design contrast | P0 |
| 07 | Austria | Vienna | Continental Central Europe; hot summer / cold winter | P0 |
| 08 | Czech Republic | Prague | Continental Central Europe | P0 |
| 09 | Poland | Warsaw | Continental / cold-winter Central Europe | P0 |
| 10 | Sweden | Stockholm | Northern maritime/continental; cold winter | P0 |
| 11 | Finland | Helsinki | Cold northern maritime climate; strong winter design case | P0 |
| 12 | Norway | Oslo | Cold Nordic climate; useful free-cooling / winter comparison | P0 |
| 13 | Spain | Madrid | Hot, dry summer; strong cooling-design case | P0 |
| 14 | Italy | Milan | Hot humid summer / continental Po Valley; major Italian DC market | P0 |
| 15 | Greece | Athens | Mediterranean; hot summer and high solar load | P0 |
| 16 | Turkey | Istanbul | Europe–Asia transition; humid coastal / hot-summer climate | P0 |

## Why these 16

The original source contains particularly large or diverse Uptime-awarded datasets in markets such as the UK, France, Italy, Spain and Turkey, while also identifying major Northern European markets that may have real DC activity despite zero Uptime awards. fileciteturn1file0L26-L69 fileciteturn1file0L71-L93 fileciteturn1file0L212-L247 fileciteturn1file0L249-L285 fileciteturn1file0L402-L433

The P0 list therefore deliberately combines **market importance + climate diversity**, rather than simply choosing countries with the most awards.

---

# 2. Expansion Research Locations — P1

**Only start these after all P0 locations are complete.**

Target: **20 additional locations**

| ID | Market | Representative City / Area | Reason |
|---|---|---|---|
| P1-01 | Belgium | Brussels / Antwerp | Benelux expansion; maritime climate |
| P1-02 | Luxembourg | Luxembourg | High concentration of Tier III/IV facilities in a small market |
| P1-03 | France | Strasbourg | Eastern France / cooler continental influence |
| P1-04 | France | Lyon | Southeastern France; warmer continental influence |
| P1-05 | Germany | Hamburg | Northern German maritime climate |
| P1-06 | Germany | Munich | Southern Germany; cooler inland/elevated climate |
| P1-07 | Switzerland | Bern | Swiss plateau climate; alternative to Zurich |
| P1-08 | Denmark | Copenhagen | Nordic maritime climate |
| P1-09 | Norway | Stavanger | Coastal western Norway; milder/wetter than Oslo |
| P1-10 | Lithuania | Vilnius | Baltic continental climate |
| P1-11 | Latvia | Riga | Baltic maritime/continental transition |
| P1-12 | Spain | Barcelona | Mediterranean coastal climate |
| P1-13 | Portugal | Lisbon | Atlantic Mediterranean; warmer coastal climate |
| P1-14 | Italy | Rome | Mediterranean central Italy |
| P1-15 | Italy | Turin | Northern Italian inland climate |
| P1-16 | Greece | Thessaloniki | Northern Greek / continental Mediterranean transition |
| P1-17 | Croatia | Zagreb | Continental Balkan climate |
| P1-18 | Romania | Bucharest | Southeastern European continental climate |
| P1-19 | Bulgaria | Sofia | Continental / elevated Balkan climate |
| P1-20 | Israel | Tel Aviv / central coastal Israel | Hot Mediterranean; high cooling load and humid coastal summer |

---

# 3. Do Not Collect Automatically — P2 / On Demand

These markets may contain data centers, but **do not collect a dedicated climate dataset in the first pass** unless a project requires it.

Examples:

- Slovakia
- Hungary
- Belarus
- Moldova
- Ukraine
- Slovenia
- Serbia
- Cyprus
- Jordan
- Albania
- Bosnia & Herzegovina
- Montenegro
- North Macedonia
- Malta
- Armenia
- Azerbaijan
- Georgia
- Russia
- Portugal (additional cities)
- Spain (additional cities)
- Italy (additional cities)
- France (additional cities)
- Germany (additional cities)
- Turkey (additional cities)

**Important:**

P2 does **not** mean:

> "No data center exists."

It means:

> "No dedicated climate dataset is required for the current first-pass research scope."

The original source explicitly warns that zero Uptime awards are not proof of zero Tier III-equivalent infrastructure. fileciteturn1file0L5-L7

---

# 4. Zero Uptime Award ≠ Zero Data Center

The source identifies several European markets that returned zero Uptime awards despite known hyperscale / colocation presence, including Sweden, Finland, Iceland and Estonia. It similarly records zero results for Slovenia, Serbia, Ukraine and Moldova. fileciteturn1file0L205-L207 fileciteturn1file0L327-L328 fileciteturn1file0L395-L396

Therefore:

```text
Uptime Award Registry
        ≠
Complete European Data Center Census
```

For this climate project, a location can be selected even when its Uptime award count is zero if it materially improves climate coverage.

This is why **Stockholm / Helsinki / Oslo** are P0 rather than being discarded.

---

# 5. Data Collection Rule

Do not collect every facility listed in the original Uptime dataset.

Example:

```text
40 London data centers
        ↓
1 London climate dataset
```

```text
20 Frankfurt data centers
        ↓
1 Frankfurt climate dataset
```

```text
100 Italian data centers
        ↓
Milan + Rome
```

The number of weather datasets should scale with **climate diversity and engineering need**, not with the number of facilities.

---

# 6. Required Weather Data Per Location

For every P0/P1 location, attempt to collect:

## A. Geographic

- Country
- City
- Latitude
- Longitude
- Elevation
- WMO station ID
- Representative weather station
- Distance from city to station

## B. Temperature

- Annual average DB
- Monthly average DB
- Monthly maximum DB
- Monthly minimum DB
- Cooling design DB
- Heating design DB
- Peak summer DB
- Extreme DB, where available

## C. Moisture

- Relative humidity
- Wet-bulb temperature
- Dew-point temperature
- Humidity ratio
- Vapor pressure, where available

## D. Environmental

Where available:

- Wind speed
- Wind direction
- Atmospheric pressure
- Global horizontal irradiance
- Direct normal irradiance
- Diffuse radiation

## E. Time-series weather

Preferred order:

1. EPW
2. TMY / TMYx
3. Hourly historical station data
4. Official meteorological data

---

# 7. Engineering Design Data

Where available, record:

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

Do not invent design values.

Every engineering value should retain:

```text
value
unit
source
source_date
station
method
```

---

# 8. Recommended Source Priority

### Priority A — Official / engineering-grade

- National meteorological agencies
- WMO
- Official weather stations
- Official airport meteorological observations
- ASHRAE climate data
- Government open-data portals

### Priority B — Building-energy weather datasets

- OneBuilding
- TMY / TMYx
- EnergyPlus weather files
- Other established engineering weather databases

### Priority C — Secondary sources

Use only when primary / engineering-grade sources are unavailable.

Always record the original source.

---

# 9. OneBuilding / EPW Strategy

For each target city:

```text
Representative City
        ↓
Find suitable WMO / weather station
        ↓
Check WMO Region 6 Europe weather files
        ↓
Select EPW / TMY / TMYx
        ↓
Record station metadata
        ↓
Store climate dataset
```

Do not download every weather station in a country.

Prefer:

> **one representative station per target city / climate zone**

unless engineering requirements justify multiple stations.

---

# 10. Climate Coverage Logic

The P0 list is intentionally not a simple "largest data-center markets" ranking.

It is a **climate + data-center engineering coverage set**.

### Maritime / Oceanic

- London
- Dublin
- Amsterdam
- Paris

### Central European

- Frankfurt
- Vienna
- Prague
- Warsaw
- Zurich

### Nordic / Cold Climate

- Stockholm
- Helsinki
- Oslo

### Hot / Dry / Mediterranean

- Madrid
- Milan
- Athens

### Europe–Asia Transition

- Istanbul

This gives the first dataset broad coverage without collecting dozens of cities.

---

# 11. HydroPuzzle Pro Integration

The final climate dataset should support:

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
      ├── WMO Station
      ├── Design DB
      ├── Design WB
      ├── Design RH
      ├── Dew Point
      └── Climate Classification
```

Example:

```text
Germany
└── Frankfurt
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

# 12. Research Order

## Phase 1 — P0

1. London
2. Dublin
3. Amsterdam
4. Frankfurt
5. Paris
6. Zurich
7. Vienna
8. Prague
9. Warsaw
10. Stockholm
11. Helsinki
12. Oslo
13. Madrid
14. Milan
15. Athens
16. Istanbul

## Phase 2 — P1

Collect the 20 expansion locations listed above.

## Phase 3 — P2

Collect only when required by:

- A real project
- A customer location
- A regional engineering study
- A new HydroPuzzle Pro requirement

---

# 13. Target Dataset Size

Recommended scope:

```text
P0 Core:
16 locations

P1 Expansion:
20 locations

P2 On-demand:
Only when required
```

### First milestone

**16 P0 locations only.**

Do not start P1 until every P0 location has:

- Verified weather source
- Representative station
- EPW/TMY/TMYx where available
- DB/WB/RH data
- Source metadata
- Engineering design-condition fields

---

# 14. Status Tracking Template

| Location | Weather Source | Station | EPW/TMY | DB | WB | RH | Dew Point | Design Data | Status |
|---|---|---|---|---|---|---|---|---|---|
| London | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Dublin | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Amsterdam | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Frankfurt | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Paris | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Zurich | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Vienna | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Prague | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Warsaw | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Stockholm | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Helsinki | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Oslo | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Madrid | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Milan | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Athens | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |
| Istanbul | TBD | TBD | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | Not Started |

---

# 15. Final Scope Rule

Do NOT turn this project into:

> "Find every Tier III / Tier IV data center in Europe."

That is a separate registry project.

The purpose of this dataset is:

> **Build a compact, engineering-useful European climate dataset for data-center HVAC and hydronic design.**

The original Uptime dataset remains the reference for identifying data-center markets and awarded facilities. The new climate dataset should remain independent from the complete facility registry.

## Final instruction

**Start with the 16 P0 locations.**

Do not expand the research scope until all 16 are complete.

The goal is not to collect the most weather files.

The goal is to collect the **smallest set of representative European climate locations that provides useful coverage for data-center HVAC engineering.**
