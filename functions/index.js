/**
 * HVAC Pro – Firebase Cloud Functions
 * 版本: 1.0  |  作者: HVAC-Pro
 *
 * 受保護的計算 API 端點：
 *  1. calculatePumps          - 冰機換算水泵
 *  2. calculateExpansionTank  - 膨脹水箱計算
 *  3. calculateCoolingTower   - 冷卻水塔補水量
 *  4. calculateAirProperties  - 空氣性質分析
 *  5. calculateACLoad         - 家用空調估算器
 *  6. calculateDuctSizing     - 風管尺寸計算
 *  7. calculateCleanRoom      - Clean Room 無塵室
 *  8. calculateExhaustDuct    - 製程排氣風管
 *  9. calculateConversion     - HVAC 單位換算
 * 10. calculateBulkGas        - 散裝氣體管路
 * 11. calculateCDS            - 化學品配送系統
 */

const functions = require("firebase-functions");
const cors = require("cors")({ origin: "https://hvac-pro-shiu.web.app" });

// ─────────────────────────────────────────────────────────────────────────────
// 速率限制（每個 IP 每分鐘最多 40 次請求）
// ─────────────────────────────────────────────────────────────────────────────
const _rl = new Map();
const RL_MAX  = 40;           // 每視窗最大請求數
const RL_WIN  = 60 * 1000;   // 視窗長度：1 分鐘

function checkRateLimit(ip) {
  const now = Date.now();
  const rec = _rl.get(ip);
  if (!rec || now - rec.ts > RL_WIN) {
    _rl.set(ip, { count: 1, ts: now });
    return true;
  }
  if (rec.count >= RL_MAX) return false;
  rec.count++;
  return true;
}

// 每 10 分鐘清理過期記錄，防止 Map 無限增長
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of _rl) {
    if (now - rec.ts > RL_WIN) _rl.delete(ip);
  }
}, 10 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// 通用 CORS 包裝器
// ─────────────────────────────────────────────────────────────────────────────
function withCors(req, res, handler) {
  cors(req, res, () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    // 速率限制檢查
    const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim()
             || req.ip
             || "unknown";
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: "Too Many Requests. Please slow down." });
    }
    try {
      handler(req, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 冰機換算水泵 (calculatePumps)
//    POST { mainRT, chwDT, chwHead, chwEff, cwDT, cwHead, cwEff, cwFactor }
// ─────────────────────────────────────────────────────────────────────────────
exports.calculatePumps = functions.https.onRequest((req, res) => {
  withCors(req, res, (req, res) => {
    const { mainRT, chwDT, chwHead, chwEff, cwDT, cwHead, cwEff, cwFactor } = req.body;

    const baseRT  = parseFloat(mainRT)  || 0;
    const _chwDT  = parseFloat(chwDT)   || 1;
    const _chwH   = parseFloat(chwHead) || 0;
    const _chwEff = parseFloat(chwEff)  || 1;

    const chwLPM = (baseRT * 3024) / (_chwDT * 60);
    const chwLPS = chwLPM / 60;
    const chwKW  = (chwLPS * _chwH) / (102 * (_chwEff / 100));

    const factor  = parseFloat(cwFactor) || 1.1;
    const cwRT    = baseRT * factor;
    const _cwDT   = parseFloat(cwDT)   || 1;
    const _cwH    = parseFloat(cwHead) || 0;
    const _cwEff  = parseFloat(cwEff)  || 1;

    const cwLPM = (cwRT * 3024) / (_cwDT * 60);
    const cwLPS = cwLPM / 60;
    const cwKW  = (cwLPS * _cwH) / (102 * (_cwEff / 100));

    res.json({
      chwLPM: +chwLPM.toFixed(2), chwLPS: +chwLPS.toFixed(2), chwKW: +chwKW.toFixed(2),
      cwLPM:  +cwLPM.toFixed(2),  cwLPS:  +cwLPS.toFixed(2),  cwKW:  +cwKW.toFixed(2),
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. 膨脹水箱計算 (calculateExpansionTank)
//    POST { sysVol, temp1, temp2, press1, press2, sf }
// ─────────────────────────────────────────────────────────────────────────────
function getWaterDensity(temp) {
  return 999.85 + (0.0678117 * temp) - (0.0090857 * temp ** 2)
    + (0.0001021 * temp ** 3) - (1.391e-6 * temp ** 4) + (6.71e-9 * temp ** 5);
}

exports.calculateExpansionTank = functions.https.onRequest((req, res) => {
  withCors(req, res, (req, res) => {
    const { sysVol, temp1, temp2, press1, press2, sf } = req.body;

    const Vs  = parseFloat(sysVol) || 0;
    const t1  = parseFloat(temp1)  || 0;
    const t2  = parseFloat(temp2)  || 0;
    const p1g = parseFloat(press1) || 0;
    const p2g = parseFloat(press2) || 0;
    const sf_ = parseFloat(sf)     || 1.2;

    const rho1 = getWaterDensity(t1);
    const rho2 = getWaterDensity(t2);

    const deltaV  = Vs * (rho1 / rho2 - 1);
    const P1_abs  = p1g + 1.033;
    const P2_abs  = p2g + 1.033;
    const theoreticalAcceptance = 1 - (P1_abs / P2_abs);

    let Vt = 0;
    if (theoreticalAcceptance > 0 && deltaV > 0) {
      Vt = (deltaV / theoreticalAcceptance) * sf_;
    }

    res.json({
      expVol:      +deltaV.toFixed(3),
      totalVol:    +Vt.toFixed(1),
      densRate:    +((rho1 / rho2 - 1) * 100).toFixed(3),
      acceptance:  +(theoreticalAcceptance * 100).toFixed(1),
      sfUsed:      +sf_.toFixed(2),
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. 冷卻水塔補水量 (calculateCoolingTower)
//    POST { rt, hrf, dt, coc, windage }
// ─────────────────────────────────────────────────────────────────────────────
const RT_TO_KW   = 3.51685;
const WATER_CP   = 4.186;
const EVAP_COEFF = 0.00153;

exports.calculateCoolingTower = functions.https.onRequest((req, res) => {
  withCors(req, res, (req, res) => {
    const { rt, hrf, dt, coc, windage } = req.body;

    const _rt      = parseFloat(rt)      || 0;
    const _hrf     = parseFloat(hrf)     || 1.25;
    const _dt      = parseFloat(dt)      || 5;
    const _coc     = parseFloat(coc)     || 4;
    const _windage = parseFloat(windage) || 0.05;

    if (_rt <= 0 || _dt <= 0 || _hrf <= 0 || _coc <= 1) {
      return res.json({ error: "Invalid input parameters" });
    }

    const windageRatio = _windage / 100;
    const circ  = (_rt * RT_TO_KW * _hrf) / (WATER_CP * _dt);
    const evap  = circ * _dt * EVAP_COEFF;
    const wind  = circ * windageRatio;

    const requiredBleed = evap / (_coc - 1);
    const rawBlow = requiredBleed - wind;
    const blow    = rawBlow < 0 ? 0 : rawBlow;
    const blowWarn = rawBlow < 0;

    const makeupA = evap + wind + blow;
    const eqcoc   = wind > 0 ? (evap + wind) / wind : 999;
    const makeupB = evap + wind;
    const rule2Pct = circ * 0.02;
    const design  = makeupA >= rule2Pct ? makeupA : rule2Pct;
    const source  = makeupA >= rule2Pct ? "Method A (actual makeup)" : "Safety rule (2% of circ)";

    res.json({
      circ:    +circ.toFixed(3),
      evap:    +evap.toFixed(3),
      wind:    +wind.toFixed(3),
      blow:    +blow.toFixed(3),
      makeupA: +makeupA.toFixed(3),
      eqcoc:   +eqcoc.toFixed(2),
      makeupB: +makeupB.toFixed(3),
      design:  +design.toFixed(3),
      source,
      blowWarn,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. 空氣性質分析 (calculateAirProperties)
//    POST { pressure, airFlow, flowUnit, dbA, secA, secTypeA, dbB, secB, secTypeB }
//    secType: "rh" | "dp" | "wb"
// ─────────────────────────────────────────────────────────────────────────────
function getPws(T_C) {
  const T = T_C + 273.15;
  let p;
  if (T_C >= 0) {
    const C8 = -5.8002206e3, C9 = 1.3914993, C10 = -4.8640239e-2,
      C11 = 4.1764768e-5, C12 = -1.4452093e-8, C13 = 6.5459673;
    p = Math.exp(C8 / T + C9 + C10 * T + C11 * T * T + C12 * T * T * T + C13 * Math.log(T));
  } else {
    const C1 = -5.6745359e3, C2 = 6.3925247, C3 = -9.677843e-3,
      C4 = 6.2215701e-7, C5 = 2.0747825e-9, C6 = -9.484024e-13, C7 = 4.1635019;
    p = Math.exp(C1 / T + C2 + C3 * T + C4 * T * T + C5 * T * T * T + C6 * T * T * T * T + C7 * Math.log(T));
  }
  return p / 1000;
}

function getAirProperties(P, DB, val, type) {
  let RH, W, VP;
  const Pws_db = getPws(DB);

  if (type === "rh") {
    RH = val / 100;
    VP = RH * Pws_db;
  } else if (type === "dp") {
    VP = getPws(val);
    RH = VP / Pws_db;
  } else if (type === "wb") {
    const WB = val;
    const Pws_wb = getPws(WB);
    const Ws_wb = 0.621945 * Pws_wb / (P - Pws_wb);
    W = ((2501 - 2.326 * WB) * Ws_wb - 1.006 * (DB - WB)) / (2501 + 1.86 * DB - 4.186 * WB);
    VP = P * W / (0.621945 + W);
    RH = VP / Pws_db;
  }

  if (W === undefined) W = 0.621945 * VP / (P - VP);
  const H = 1.006 * DB + W * (2501 + 1.86 * DB);
  const volume = 0.287042 * (DB + 273.15) * (1 + 1.6078 * W) / P;
  const density = (1 + W) / volume;

  return { db: DB, rh: +(RH * 100).toFixed(2), w: +W.toFixed(5), h: +H.toFixed(2), density: +density.toFixed(4) };
}

exports.calculateAirProperties = functions.https.onRequest((req, res) => {
  withCors(req, res, (req, res) => {
    const { pressure, airFlow, flowUnit, dbA, secA, secTypeA, dbB, secB, secTypeB } = req.body;

    const P    = parseFloat(pressure) || 101.325;
    const flow = parseFloat(airFlow)  || 0;
    const CMH  = flowUnit === "cfm" ? flow * 1.69901 : flow;

    const propA = getAirProperties(P, parseFloat(dbA), parseFloat(secA), secTypeA || "rh");
    const propB = getAirProperties(P, parseFloat(dbB), parseFloat(secB), secTypeB || "rh");

    const massFlow   = CMH * propA.density;
    const dehumid    = massFlow * (propA.w - propB.w);
    const totalKW    = massFlow * (propA.h - propB.h) / 3600;
    const sensKW     = massFlow * 1.006 * (propA.db - propB.db) / 3600;
    const latentKW   = totalKW - sensKW;
    const totalRT    = totalKW / 3.51685;
    const shr        = totalKW !== 0 ? sensKW / totalKW : 0;

    res.json({
      propA,
      propB,
      dehumid:  +dehumid.toFixed(2),
      totalKW:  +totalKW.toFixed(2),
      totalRT:  +totalRT.toFixed(2),
      sensKW:   +sensKW.toFixed(2),
      latentKW: +latentKW.toFixed(2),
      shr:      +shr.toFixed(3),
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. 家用空調估算器 (calculateACLoad)
//    POST { mode: "split"|"vrf", ... }
//    split: { area, unit, roomType, region, topFloor, westExposed, highCeiling }
//    vrf:   { zones: [{roomType, area, topFloor, westExposed}], diversity, condition }
// ─────────────────────────────────────────────────────────────────────────────
const PING_TO_M2 = 3.305;
const KCAL_TO_KW = 860;
const ROOM_TYPES = {
  bedroom:   { baseKcal: 500,  hours: 2000 },
  living:    { baseKcal: 600,  hours: 1500 },
  study:     { baseKcal: 500,  hours: 800  },
  top_floor: { baseKcal: 750,  hours: 2400 },
};
const REGIONS = {
  north:    { heatingFactor: 0.75 },
  central:  { heatingFactor: 0.90 },
  mountain: { heatingFactor: 0.65 },
};

exports.calculateACLoad = functions.https.onRequest((req, res) => {
  withCors(req, res, (req, res) => {
    const { mode, area, unit, roomType, region, topFloor, westExposed, highCeiling, zones, diversity, condition } = req.body;

    if (mode === "split" || !mode) {
      const ping = (unit === "ping") ? parseFloat(area) : parseFloat(area) / PING_TO_M2;
      const base = ROOM_TYPES[roomType || "bedroom"].baseKcal;
      const mult = 1 + (topFloor ? 0.2 : 0) + (westExposed ? 0.2 : 0) + (highCeiling ? 0.1 : 0);
      const kcal = ping * base * mult;
      const kw   = +(kcal / KCAL_TO_KW).toFixed(2);
      const hKw  = +(kw * (REGIONS[region || "north"].heatingFactor)).toFixed(2);

      return res.json({
        mode: "split",
        kw,
        ton: +(kcal / 2500).toFixed(2),
        kcal: Math.round(kcal),
        hKw,
        regionFactor: REGIONS[region || "north"].heatingFactor,
        multiplier: mult.toFixed(1),
        hours: ROOM_TYPES[roomType || "bedroom"].hours,
      });
    }

    if (mode === "vrf") {
      const _zones = zones || [];
      const _diversity = parseFloat(diversity) || 80;
      const condFactor = (condition === "hot") ? 1.15 : (condition === "mild") ? 0.9 : 1.0;

      let totalKW = 0;
      const zoneResults = _zones.map((z) => {
        const base = ROOM_TYPES[z.roomType || "bedroom"].baseKcal;
        const mult = 1 + (z.topFloor ? 0.2 : 0) + (z.westExposed ? 0.2 : 0);
        const kcal = (z.area || 0) * base * mult;
        const kw   = kcal / KCAL_TO_KW;
        totalKW += kw;
        return { roomType: z.roomType, area: z.area, kw: +kw.toFixed(2) };
      });

      const vrfKW    = totalKW * (_diversity / 100) * condFactor;
      const outdoorHP = Math.ceil(vrfKW / 2.8 * 2) / 2;

      return res.json({
        mode: "vrf",
        zones: zoneResults,
        totalIndoorKW: +totalKW.toFixed(2),
        vrfDesignKW:   +vrfKW.toFixed(2),
        outdoorHP,
      });
    }

    res.status(400).json({ error: "Invalid mode" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. 風管尺寸計算 (calculateDuctSizing)
//    POST { airflow, airflowUnit, material, method, targetFriction, targetVelocity,
//           shape, preferredHeight }
// ─────────────────────────────────────────────────────────────────────────────
const RHO_DUCT = 1.2;       // kg/m³
const MU_DUCT  = 1.81e-5;   // Pa·s

function calcFrictionFactorDuct(Re, D, epsilon) {
  if (Re < 2300) return 64 / Re;
  const relRough = epsilon / D;
  return 0.25 / Math.pow(Math.log10(relRough / 3.7 + 5.74 / Math.pow(Re, 0.9)), 2);
}

function calcPressureLossPerMeter(V, D, epsilon) {
  const Re = (RHO_DUCT * V * D) / MU_DUCT;
  const f  = calcFrictionFactorDuct(Re, D, epsilon);
  return f * (RHO_DUCT * V * V / 2) * (1 / D);
}

function findEqualFrictionDiameter(Q, targetPf, epsilon) {
  let bestD  = 0.15;
  let minDiff = Infinity;
  const maxD  = Q > 8 ? 3.0 : 2.5;
  for (let d = 0.05; d <= maxD; d += 0.005) {
    const area = Math.PI * d * d / 4;
    const V    = Q / area;
    const pf   = calcPressureLossPerMeter(V, d, epsilon);
    const diff = Math.abs(pf - targetPf);
    if (diff < minDiff) { minDiff = diff; bestD = d; }
  }
  return bestD;
}

exports.calculateDuctSizing = functions.https.onRequest((req, res) => {
  withCors(req, res, (req, res) => {
    const { airflow, airflowUnit, material, method, targetFriction, targetVelocity, shape, preferredHeight } = req.body;

    const airflowVal = parseFloat(airflow) || 0;
    const Q = (airflowUnit === "CMH") ? airflowVal / 3600 : (airflowVal * 1.699) / 3600;
    if (Q <= 0) return res.json({ error: "Airflow must be > 0" });

    const epsilon = parseFloat(material) || 0.0001;

    let De;
    if (method === "friction") {
      De = findEqualFrictionDiameter(Q, parseFloat(targetFriction) || 1.0, epsilon);
    } else {
      const tv = parseFloat(targetVelocity) || 5;
      De = Math.sqrt((4 * Q) / (Math.PI * tv));
    }

    if (!shape || shape === "round") {
      const D_mm  = Math.ceil((De * 1000) / 25) * 25;
      const realD = D_mm / 1000;
      const V     = Q / (Math.PI * realD * realD / 4);
      const pf    = calcPressureLossPerMeter(V, realD, epsilon);
      return res.json({ shape: "round", diameter_mm: D_mm, velocity: +V.toFixed(2), pressureLoss_Pa_m: +pf.toFixed(3) });
    }

    // Rectangular
    const prefH  = parseFloat(preferredHeight) || 300;
    const H      = prefH / 1000;
    const W      = (De * De * Math.PI / 4) / H;
    const W_mm   = Math.ceil(W * 1000 / 50) * 50;
    const realH  = H * 1000;
    const dh     = (2 * W_mm / 1000 * H) / (W_mm / 1000 + H);
    const area   = (W_mm / 1000) * H;
    const V      = Q / area;
    const pf     = calcPressureLossPerMeter(V, dh, epsilon);
    res.json({
      shape: "rect", width_mm: W_mm, height_mm: realH,
      velocity: +V.toFixed(2), pressureLoss_Pa_m: +pf.toFixed(3),
      De_mm: +(De * 1000).toFixed(0),
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Clean Room 計算 (calculateCleanRoom)
//    POST { room: { area, height, ffuQty, ffuV, ffuSize, mauTarget, exhaust,
//                   unitHeat, tempIn, tempOut, rho, cp, returnType, returnArea,
//                   dccList } }
// ─────────────────────────────────────────────────────────────────────────────
const FFU_SIZES_DATA = { "600x1200": 0.72, "610x1220": 0.7442, "1200x1200": 1.44, "custom": 1.44 };

function ffuAreaCalc(r) {
  if (r.ffuSize === "custom") return parseFloat(r.ffuCustomArea) || 1.44;
  return FFU_SIZES_DATA[r.ffuSize] || 1.44;
}

function calcRoomData(r) {
  const fa         = ffuAreaCalc(r);
  const singleFlow = r.ffuV * fa * 3600;
  const totalFlow  = r.ffuQty * singleFlow;
  const vol        = r.area * r.height;
  const ach        = vol > 0 ? totalFlow / vol : 0;
  const mau        = r.area * r.height * (r.mauTarget || 0) + (r.exhaust || 0);
  const totalHeat  = r.area * (r.unitHeat || 0);
  const dT         = Math.abs((r.tempIn || 0) - (r.tempOut || 0));
  const coverage   = r.area > 0 ? (r.ffuQty * fa / r.area * 100) : 0;
  const rho        = r.rho || 1.2;
  const cp         = r.cp || 1.005;

  const reqFlow = dT > 0 ? (totalHeat / (rho * cp * dT)) * 3600 : 0;
  const recFfu  = dT > 0 && r.ffuV > 0 ? Math.ceil(reqFlow / singleFlow) : 0;

  let dccTotal = 0;
  const dccList = (r.dccList || []).map((d) => {
    const kw = d.v * (d.length * d.width * d.count) * rho * cp * dT;
    dccTotal += kw;
    return { ...d, kw: +kw.toFixed(2) };
  });

  const balance      = totalHeat > 0 ? (dccTotal / totalHeat * 100) : 0;
  const retV         = r.returnArea > 0 ? (totalFlow / r.returnArea / 3600) : 0;
  const recReturnArea = totalFlow / (2.5 * 3600);

  return {
    fa: +fa.toFixed(2),
    singleFlow: +singleFlow.toFixed(1),
    totalFlow:  +totalFlow.toFixed(1),
    vol:        +vol.toFixed(1),
    ach:        +ach.toFixed(1),
    mau:        +mau.toFixed(1),
    totalHeat:  +totalHeat.toFixed(1),
    dT:         +dT.toFixed(1),
    coverage:   +coverage.toFixed(1),
    recFfu,
    reqFlow:    +reqFlow.toFixed(1),
    dccList,
    dccTotal:   +dccTotal.toFixed(2),
    balance:    +balance.toFixed(1),
    retV:       +retV.toFixed(2),
    recReturnArea: +recReturnArea.toFixed(2),
  };
}

exports.calculateCleanRoom = functions.https.onRequest((req, res) => {
  withCors(req, res, (req, res) => {
    const { room, rooms } = req.body;

    if (rooms && Array.isArray(rooms)) {
      const results = rooms.map((r) => calcRoomData(r));
      const gMau = results.reduce((s, r) => s + r.mau, 0);
      const gRT  = results.reduce((s, r) => s + r.dccTotal / RT_TO_KW, 0);
      return res.json({ rooms: results, gMau: +gMau.toFixed(1), gRT: +gRT.toFixed(1) });
    }

    if (room) {
      return res.json(calcRoomData(room));
    }

    res.status(400).json({ error: "Provide room or rooms array" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. 製程排氣風管速度 (calculateExhaustDuct)
//    POST { airflow_cmh, shape, diameter_mm, width_mm, height_mm }
// ─────────────────────────────────────────────────────────────────────────────
exports.calculateExhaustDuct = functions.https.onRequest((req, res) => {
  withCors(req, res, (req, res) => {
    const { airflow_cmh, shape, diameter_mm, width_mm, height_mm } = req.body;

    const Q = (parseFloat(airflow_cmh) || 0) / 3600; // m³/s
    const V_MIN = 6.0, V_MAX = 15.0;
    let D_mm = 0, actualV = 0;

    if (shape === "round") {
      D_mm = parseFloat(diameter_mm) || 0;
      if (D_mm > 0) {
        const area = Math.PI * Math.pow(D_mm / 1000 / 2, 2);
        actualV = Q / area;
      }
    } else {
      const W = parseFloat(width_mm)  || 0;
      const H = parseFloat(height_mm) || 0;
      if (W > 0 && H > 0) {
        D_mm = 1.30 * Math.pow(W * H, 0.625) / Math.pow(W + H, 0.25);
        const area = (W / 1000) * (H / 1000);
        actualV = Q / area;
      }
    }

    const status = actualV < V_MIN ? "low" : actualV > V_MAX ? "high" : "ok";

    res.json({
      velocity:   +actualV.toFixed(2),
      Deq_mm:     +D_mm.toFixed(0),
      status,
      vMin: V_MIN, vMax: V_MAX,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. HVAC 單位換算 (calculateConversion)
//    POST { value, fromUnit, toUnit, category, dtAir, dtWater }
// ─────────────────────────────────────────────────────────────────────────────
const UNIT_DATA = {
  power: {
    kW: 1, W: 0.001, hp: 0.7457, "kcal/h": 1 / 860, BTU_h: 1 / 3412.14,
  },
  flow_vol: {
    "m3/h": 1, "L/s": 3.6, CFM: 1.699, "m3/s": 3600, "L/min": 0.06,
  },
  pressure: {
    Pa: 1, kPa: 1000, bar: 100000, psi: 6894.76, mmHg: 133.322, mmH2O: 9.80665, atm: 101325,
  },
  length: {
    m: 1, mm: 0.001, ft: 0.3048, inch: 0.0254, cm: 0.01,
  },
  mass_flow: {
    "kg/s": 1, "kg/h": 1 / 3600, "L/s": 1, "L/min": 1 / 60,
  },
  refrigeration: {
    RT: 3.51685, kW: 1, BTU_h: 1 / 3412.14, "kcal/h": 1 / 860,
  },
};

exports.calculateConversion = functions.https.onRequest((req, res) => {
  withCors(req, res, (req, res) => {
    const { value, fromUnit, toUnit, category } = req.body;
    const val = parseFloat(value);
    if (isNaN(val)) return res.json({ error: "Invalid value" });

    if (category === "temperature") {
      let celsius;
      if (fromUnit === "C")      celsius = val;
      else if (fromUnit === "F") celsius = (val - 32) / 1.8;
      else if (fromUnit === "K") celsius = val - 273.15;
      else return res.json({ error: "Unknown temperature unit" });

      let result;
      if (toUnit === "C")      result = celsius;
      else if (toUnit === "F") result = celsius * 1.8 + 32;
      else if (toUnit === "K") result = celsius + 273.15;
      else return res.json({ error: "Unknown temperature unit" });
      return res.json({ result: +result.toFixed(6) });
    }

    const cat = UNIT_DATA[category];
    if (!cat) return res.json({ error: `Unknown category: ${category}` });
    if (cat[fromUnit] === undefined || cat[toUnit] === undefined) {
      return res.json({ error: `Unknown unit: ${fromUnit} or ${toUnit}` });
    }

    const kw_equiv = val * cat[fromUnit];
    const result   = kw_equiv / cat[toUnit];
    res.json({ result: +result.toFixed(8) });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Bulk Gas System (calculateBulkGas)
//     POST { gasKey, pInAbs, tempC, flowSCMH, pipeLength, fittings, schedule,
//            maxV, maxDP, safetyMargin }
// ─────────────────────────────────────────────────────────────────────────────
const C_GAS = {
  P_STD:    101325,
  T_STD:    273.15,
  R_UNI:    8314.46,
  ROUGHNESS: 0.000045,
  BAR_TO_PA: 100000,
};

const GASES = {
  GN2: { M: 28.014, rhoStd: 1.2506, mu: 17.8e-6, gamma: 1.4, limitV: 25 },
  PN2: { M: 28.014, rhoStd: 1.2506, mu: 17.8e-6, gamma: 1.4, limitV: 25 },
  GH2: { M: 2.016,  rhoStd: 0.0899, mu: 8.9e-6,  gamma: 1.41, limitV: 10 },
  GO2: { M: 32.000, rhoStd: 1.4289, mu: 20.4e-6, gamma: 1.4,  limitV: 6  },
  PAr: { M: 39.948, rhoStd: 1.7839, mu: 22.7e-6, gamma: 1.67, limitV: 20 },
  PHe: { M: 4.003,  rhoStd: 0.1786, mu: 19.9e-6, gamma: 1.67, limitV: 20 },
};

const FITTING_DEFS = {
  elbow90sr: { leD: 30 }, elbow90lr: { leD: 16 }, elbow45: { leD: 16 },
  teeRun: { leD: 20 }, teeBranch: { leD: 60 }, gateValve: { leD: 8 },
  globeValve: { leD: 340 }, checkValve: { leD: 100 }, filter: { leD: 400 },
};

const GAS_PIPE_SIZES = [
  { label: "15A (½\")",   id40: 15.80,  id80: 13.87 },
  { label: "20A (¾\")",   id40: 20.93,  id80: 18.85 },
  { label: "25A (1\")",   id40: 26.64,  id80: 24.30 },
  { label: "40A (1½\")",  id40: 40.89,  id80: 38.10 },
  { label: "50A (2\")",   id40: 52.50,  id80: 49.25 },
  { label: "65A (2½\")",  id40: 62.71,  id80: 59.00 },
  { label: "80A (3\")",   id40: 77.93,  id80: 73.66 },
  { label: "100A (4\")",  id40: 102.26, id80: 97.18  },
  { label: "150A (6\")",  id40: 154.05, id80: 146.33 },
  { label: "200A (8\")",  id40: 202.72, id80: 193.68 },
  { label: "300A (12\")", id40: 303.23, id80: 288.93 },
];

exports.calculateBulkGas = functions.https.onRequest((req, res) => {
  withCors(req, res, (req, res) => {
    const { gasKey, pInAbs, tempC, flowSCMH, pipeLength, fittings, schedule, maxV, maxDP, safetyMargin } = req.body;

    const gas = GASES[gasKey];
    if (!gas) return res.status(400).json({ error: `Unknown gasKey: ${gasKey}` });

    const margin   = safetyMargin ? 0.8 : 1.0;
    const R_sp     = C_GAS.R_UNI / gas.M;
    const tAbs     = (parseFloat(tempC) || 25) + 273.15;
    const a_sonic  = Math.sqrt(gas.gamma * R_sp * tAbs);
    const mDot     = ((parseFloat(flowSCMH) || 0) / 3600) * gas.rhoStd;
    const pIn      = parseFloat(pInAbs) || 500000;
    const pipeLen  = parseFloat(pipeLength) || 10;
    const _maxDP   = parseFloat(maxDP) || 0.1;
    const _maxV    = parseFloat(maxV) || gas.limitV;

    const fits = fittings || {};
    const totalLeD = Object.entries(fits).reduce((sum, [key, count]) => {
      return sum + (FITTING_DEFS[key] ? FITTING_DEFS[key].leD * count : 0);
    }, 0);

    const sched = schedule || "sch40";
    const results = GAS_PIPE_SIZES.map((pipe) => {
      const id_mm = sched === "sch80" ? pipe.id80 : pipe.id40;
      const D = id_mm / 1000;
      const A = Math.PI * D * D / 4;
      const G = mDot / A;
      const Re_in = (G * D) / gas.mu;

      let f = Re_in < 2000 ? 64 / Math.max(Re_in, 1)
        : 0.25 / Math.pow(Math.log10(C_GAS.ROUGHNESS / D / 3.7 + 5.74 / Math.pow(Re_in, 0.9)), 2);

      let pOut = pIn;
      for (let i = 0; i < 20; i++) {
        const pAvg = (pIn + pOut) / 2;
        const dyn  = (G * G * R_sp * tAbs) / (2 * pAvg);
        const dpFric = f * (pipeLen / D) * dyn;
        const dpFit  = f * totalLeD * dyn;
        const pOutNew = pIn - dpFric - dpFit;
        if (Math.abs(pOutNew - pOut) < 5 || pOutNew <= 1000) { pOut = Math.max(pOutNew, 1000); break; }
        pOut = pOutNew;
      }

      const dpTot    = pIn - pOut;
      const pAvgFin  = (pIn + pOut) / 2;
      const rhoAvg   = pAvgFin / (R_sp * tAbs);
      const uAvg     = G / rhoAvg;
      const machAvg  = uAvg / a_sonic;
      const dpBar    = dpTot / C_GAS.BAR_TO_PA;
      const vSafe    = uAvg <= _maxV * margin;
      const pSafe    = dpBar <= _maxDP * margin;
      const machSafe = machAvg < 0.3;
      const isSafe   = vSafe && pSafe && machSafe;

      return {
        label: pipe.label, id_mm, Re: Math.round(Re_in),
        uAvg: +uAvg.toFixed(2), machAvg: +machAvg.toFixed(3),
        dpBar: +dpBar.toFixed(4), vSafe, pSafe, machSafe, isSafe,
      };
    });

    const recommended = results.find((r) => r.isSafe) || results[results.length - 1];
    res.json({ results, recommended });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. CDS 化學品配送系統 (calculateCDS)
//     POST { chemKey, matKey, flowLPM, pipeLen, elevation, fittings,
//            filterQty, filterDP, valveQty, valveDP,
//            reqPressureBar, pumpMaxPBar, tempC, safetyMargin }
// ─────────────────────────────────────────────────────────────────────────────
const G_GRAVITY = 9.81;
const P_ATM_PA  = 101325;

const CHEM_DB = {
  DIW:   { sg: 1.00, visc: 1.002, vaporP: 2.338,  minV: 0.5, maxVelocity: 3.0 },
  IPA:   { sg: 0.786, visc: 2.40, vaporP: 5.87,   minV: 0.3, maxVelocity: 2.5 },
  H2SO4: { sg: 1.84, visc: 26.7,  vaporP: 0.001,  minV: 0.2, maxVelocity: 1.5 },
  HF:    { sg: 1.15, visc: 0.49,  vaporP: 122,    minV: 0.3, maxVelocity: 2.0 },
  H2O2:  { sg: 1.45, visc: 1.24,  vaporP: 0.8,    minV: 0.2, maxVelocity: 2.0 },
  NH3:   { sg: 0.73, visc: 0.27,  vaporP: 1016,   minV: 0.3, maxVelocity: 2.5 },
  HCl:   { sg: 1.18, visc: 1.8,   vaporP: 313,    minV: 0.2, maxVelocity: 2.0 },
  NMP:   { sg: 1.028, visc: 1.65, vaporP: 0.04,   minV: 0.3, maxVelocity: 2.5 },
};

const MATERIAL_DB = {
  PVDF:  { maxV: 3.0, eps: 0.0000015 },
  PFA:   { maxV: 2.5, eps: 0.0000015 },
  SS316L:{ maxV: 4.0, eps: 0.000046  },
  PP:    { maxV: 2.0, eps: 0.0000015 },
};

const CDS_FITTING_DB = {
  elbow90: { K: 0.9 }, elbow45: { K: 0.4 },
  teeRun:  { K: 0.3 }, teeBranch: { K: 1.5 },
  ballValve: { K: 0.2 }, checkValve: { K: 2.0 }, strainer: { K: 3.0 },
};

const CDS_PIPE_SIZES = [
  { label: "1/4\"", id_mm: 6.3 }, { label: "3/8\"", id_mm: 9.5 },
  { label: "1/2\"", id_mm: 12.7 }, { label: "3/4\"", id_mm: 19.1 },
  { label: "1\"",   id_mm: 25.4 }, { label: "1.5\"", id_mm: 38.1 },
  { label: "2\"",   id_mm: 50.8 }, { label: "3\"",   id_mm: 76.2 },
];

function waterVaporKpa(tC) {
  return 0.6113 * Math.exp((17.67 * tC) / (tC + 243.5));
}

exports.calculateCDS = functions.https.onRequest((req, res) => {
  withCors(req, res, (req, res) => {
    const {
      chemKey, matKey, flowLPM, pipeLen, elevation, fittings,
      filterQty, filterDP, valveQty, valveDP,
      reqPressureBar, pumpMaxPBar, tempC, safetyMargin,
    } = req.body;

    const chem = CHEM_DB[chemKey || "DIW"];
    const mat  = MATERIAL_DB[matKey || "PVDF"];
    if (!chem || !mat) return res.status(400).json({ error: "Unknown chemKey or matKey" });

    const rho   = chem.sg * 1000;
    const mu    = chem.visc / 1000;
    const Q_m3s = (parseFloat(flowLPM) || 0) / 60000;
    const len   = parseFloat(pipeLen)      || 10;
    const elev  = parseFloat(elevation)    || 0;
    const fQ    = parseFloat(filterQty)    || 0;
    const fDP   = parseFloat(filterDP)     || 0;
    const vQ    = parseFloat(valveQty)     || 0;
    const vDP   = parseFloat(valveDP)      || 0;
    const reqP  = parseFloat(reqPressureBar) || 0;
    const pMax  = parseFloat(pumpMaxPBar)  || 10;
    const temp  = parseFloat(tempC)        || 25;
    const margin = safetyMargin ? 0.85 : 1.0;
    const maxV   = Math.min(mat.maxV, chem.maxVelocity) * margin;

    const fits  = fittings || {};
    const totalK = Object.entries(fits).reduce((s, [k, cnt]) => s + (CDS_FITTING_DB[k] ? CDS_FITTING_DB[k].K * cnt : 0), 0);

    const results = CDS_PIPE_SIZES.map((pipe) => {
      const D  = pipe.id_mm / 1000;
      const A  = Math.PI * D * D / 4;
      const v  = Q_m3s / A;
      const Re = (rho * v * D) / mu;

      let f = Re < 2000 ? 64 / Math.max(Re, 1)
        : 0.25 / Math.pow(Math.log10(mat.eps / (3.7 * D) + 5.74 / Math.pow(Re, 0.9)), 2);

      const v2_2g    = (v * v) / (2 * G_GRAVITY);
      const hFriction = f * (len / D) * v2_2g;
      const hFitting  = totalK * v2_2g;
      const hFilter   = (fQ * fDP * 1e5) / (rho * G_GRAVITY);
      const hValve    = (vQ * vDP * 1e5) / (rho * G_GRAVITY);
      const hReqP     = (reqP * 1e5) / (rho * G_GRAVITY);
      const TDH       = hFriction + hFitting + elev + hFilter + hValve + hReqP;
      const P_pump    = (rho * G_GRAVITY * TDH) / 1e5;

      const P_vapor   = (chem.vaporP || waterVaporKpa(temp)) * 1000;
      const NPSHa     = (P_ATM_PA / (rho * G_GRAVITY)) - P_vapor / (rho * G_GRAVITY) - elev;

      const vSafe = v >= chem.minV && v <= maxV;
      const pSafe = P_pump <= pMax * margin;

      return {
        label: pipe.label, id_mm: pipe.id_mm,
        v: +v.toFixed(3), Re: Math.round(Re),
        TDH: +TDH.toFixed(2), P_pump_bar: +P_pump.toFixed(3),
        NPSHa: +NPSHa.toFixed(2), vSafe, pSafe,
        isSafe: vSafe && pSafe,
      };
    });

    const recommended = results.find((r) => r.isSafe) || results[results.length - 1];
    res.json({ results, recommended });
  });
});
