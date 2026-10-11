'use strict';
/**
 * annual_runner.js - Annual Simulation Runner and Unit Simulation Engine
 * Encapsulates the 8760-hour simulation loop, unit simulation (simulateUnit),
 * energy/thermal/hydraulic ledgers, and multi-dimensional hourly profile generation.
 */
(function (root) {
    const MONTH_HOURS = [744, 672, 744, 720, 744, 720, 744, 744, 720, 744, 720, 744]; // Total 8760
    const MONTH_START = [];
    {
        let acc = 0;
        for (let m = 0; m < 12; m++) {
            MONTH_START.push(acc);
            acc += MONTH_HOURS[m];
        }
    }

    const HOUR_TO_MONTH_LUT = new Uint8Array(8760);
    for (let i = 0; i < 8760; i++) {
        for (let m = 11; m >= 0; m--) {
            if (i >= MONTH_START[m]) {
                HOUR_TO_MONTH_LUT[i] = m;
                break;
            }
        }
    }

    function hourToMonth(hourIdx) {
        if (hourIdx >= 0 && hourIdx < 8760) return HOUR_TO_MONTH_LUT[hourIdx];
        for (let m = 11; m >= 0; m--) {
            if (hourIdx >= MONTH_START[m]) return m;
        }
        return 0;
    }

    const AnnualRunner = {
        hourToMonth,

        /**
         * Simulates an individual unit (DU or CorePod) across 8760 hours.
         * Pure thermodynamic interface: depends only on plantDesign, loadSumm, and weather.
         *
         * @param {Object} plantDesign - { cduSystem, fanwallSystem }
         * @param {Object} loadSumm - { totalItKw, liquidHeatKw, airHeatKw, lossKw, dlcPct }
         * @param {Array} hourlyWeather - Array of 8760 { db, wb }
         * @param {Object} helpers - { calcHourlyEnergy, onHour }
         * @returns {Object} Simulation metrics for the unit
         */
        simulateUnit(plantDesign, loadSumm, hourlyWeather, helpers = {}) {
            const calcHourlyEnergy = helpers.calcHourlyEnergy
                || (root.AppStore?.calcHourlyEnergy ? root.AppStore.calcHourlyEnergy.bind(root.AppStore) : null);
            if (!calcHourlyEnergy) {
                throw new Error('calcHourlyEnergy helper required for simulateUnit');
            }

            const onHour = helpers.onHour;
            const itKw = loadSumm.totalItKw || 0;
            const lossKw = loadSumm.lossKw || 0;

            const kwh = { it: 0, cduPump: 0, crahFan: 0, heatRejection: 0, chiller: 0, loss: 0 };
            const cduKwh = { unit: 0, pump: 0, heatRej: 0, chiller: 0 };
            const fwKwh = { crahFan: 0, heatRej: 0, chiller: 0 };
            let waterM3 = 0;
            let fcHours = 0;
            let deficitHours = 0;
            let maxDeficitKw = 0;
            let heatRemovedKwh = 0;
            let chillerEnvelopeHours = 0;
            const cduModeHours = { free: 0, partial: 0, mechanical: 0 };
            const fwModeHours = { free: 0, partial: 0, mechanical: 0 };

            // P2-2: 8760 迴圈外預先解析設備與與小時無關之負載參數量 (優化效能)
            const cduSys = plantDesign.cduSystem || {};
            const fwSys  = plantDesign.fanwallSystem || {};
            const cduArch = cduSys.architecture || 'dry_cooler_hx';
            const fwArch  = fwSys.architecture || 'air_cooled_chiller';
            const cduArchDesc = (typeof root.CoolingArchRegistry !== 'undefined') ? root.CoolingArchRegistry.get(cduArch) : null;
            const fwArchDesc  = (typeof root.CoolingArchRegistry !== 'undefined') ? root.CoolingArchRegistry.get(fwArch) : null;

            const cduEquip = (root.AppStore?.resolveEquipment)
                ? root.AppStore.resolveEquipment(cduArchDesc, cduSys)
                : {};
            const fwEquip  = (root.AppStore?.resolveEquipment)
                ? root.AppStore.resolveEquipment(fwArchDesc, fwSys)
                : {};

            const designLiqKw = cduSys.designBasis?.liq_load_kw || loadSumm.liquidHeatKw;
            const cduLoadRatio = designLiqKw > 0 ? Math.min(1.0, loadSumm.liquidHeatKw / designLiqKw) : 1.0;

            const airHeatTotal = (loadSumm.airHeatKw || 0) + lossKw;
            const designAirKw = fwSys.designBasis?.air_load_kw || airHeatTotal;
            const fwLoadRatio = designAirKw > 0 ? Math.min(1.0, airHeatTotal / designAirKw) : 1.0;

            const chwSupplyC = fwSys.chwSupplyC || 12.0;
            const chwReturnC = fwSys.chwReturnC || 18.0;
            const fwBaseCop = chwSupplyC >= 20 ? 5.8 : (chwSupplyC >= 12 ? 4.2 : 3.0);

            const trimItem = (cduSys.sizing || []).find(s => s.key === 'trim_chiller');
            const trimCop = trimItem?.catalog?.find(c => c.model === trimItem.selectedModel)?.cop || 6.2;

            const cduUnits = cduEquip.cdu_unit || [];
            let cduUnitKw = 0;
            let cduDeficitKw = 0;
            if (cduUnits.length > 0 && typeof root.CDUEngine !== 'undefined' && loadSumm.liquidHeatKw > 0) {
                const cduRes = root.CDUEngine.calcPower(cduUnits, loadSumm.liquidHeatKw);
                cduUnitKw = cduRes.power_kw;
                cduDeficitKw = cduRes.deficit_kw || 0;
            } else if (loadSumm.liquidHeatKw > 0) {
                cduUnitKw = (loadSumm.liquidHeatKw / 400) * 2.0;
            }

            const isFwRdhx = !!fwArchDesc?.flags?.isRdhx;
            const fwUnits = (isFwRdhx ? fwEquip.rdhx_unit : fwEquip.crah_unit) || [];
            let crahFanKw = 0;
            let crahDeficitKw = 0;
            if (fwUnits.length > 0 && typeof root.CRAHEngine !== 'undefined' && airHeatTotal > 0) {
                const crahRes = root.CRAHEngine.calcPower(fwUnits, airHeatTotal);
                crahFanKw = crahRes.power_kw;
                if (crahRes.deficit_kw > 0) {
                    crahDeficitKw = crahRes.deficit_kw;
                }
            } else {
                crahFanKw = (isFwRdhx ? (airHeatTotal / 60) * 1.2 : (airHeatTotal / 60) * 4.8);
            }

            const cduPumps = cduEquip.cdu_pump || [];
            const fwPumps = fwEquip.fw_pump || [];

            // Precompute pump operating mode table for 3 seasonal conditions:
            // 0: SUMMER (wb >= 24), 1: SHOULDER (16 <= wb < 24), 2: WINTER (wb < 16)
            const modes = [
                root.FreeCoolingEngine?.PLANT_MODE?.SUMMER || 'summer',
                root.FreeCoolingEngine?.PLANT_MODE?.SHOULDER || 'shoulder',
                root.FreeCoolingEngine?.PLANT_MODE?.WINTER || 'winter'
            ];
            const pumpTable = modes.map(mode => {
                const cduPumpMin = (typeof root.FreeCoolingEngine !== 'undefined') ? root.FreeCoolingEngine.getPumpMinSpeed(mode) : 0.45;
                const cduPumpSpd = Math.max(cduPumpMin, cduLoadRatio);
                const cduFanMin  = (typeof root.FreeCoolingEngine !== 'undefined') ? root.FreeCoolingEngine.getCtFanMinSpeed(mode) : 0.20;
                const cduPriKw   = (cduPumps.length > 0 && typeof root.PlantPumpEngine !== 'undefined' && loadSumm.liquidHeatKw > 0)
                    ? root.PlantPumpEngine.calcPower(cduPumps, cduPumpSpd)
                    : (loadSumm.liquidHeatKw > 0 ? (loadSumm.liquidHeatKw / 500) * (cduSys.hydraulics?.pump_power_kw || 11.0) : 0);

                const fwPumpMin = (typeof root.FreeCoolingEngine !== 'undefined') ? root.FreeCoolingEngine.getPumpMinSpeed(mode) : 0.45;
                const fwPumpSpd = Math.max(fwPumpMin, fwLoadRatio);
                const fwFanMin  = (typeof root.FreeCoolingEngine !== 'undefined') ? root.FreeCoolingEngine.getCtFanMinSpeed(mode) : 0.20;
                const fwPmpKw   = (fwPumps.length > 0 && typeof root.PlantPumpEngine !== 'undefined' && airHeatTotal > 0)
                    ? root.PlantPumpEngine.calcPower(fwPumps, fwPumpSpd)
                    : 0;

                return {
                    cduPumpSpeed: cduPumpSpd,
                    cduFanMinSpeed: cduFanMin,
                    cduPrimaryPumpKw: cduPriKw,
                    cduPumpKw: cduUnitKw + cduPriKw,
                    fwPumpSpeed: fwPumpSpd,
                    fwFanMinSpeed: fwFanMin,
                    fwPumpKw: fwPmpKw
                };
            });

            const pre = {
                cduArchDesc,
                fwArchDesc,
                cduEquip,
                fwEquip,
                designLiqKw,
                cduLoadRatio,
                airHeatTotal,
                designAirKw,
                fwLoadRatio,
                chwSupplyC,
                chwReturnC,
                fwBaseCop,
                trimCop,
                cduUnits,
                cduUnitKw,
                cduDeficitKw,
                fwUnits,
                crahFanKw,
                crahDeficitKw,
                cduPumps,
                fwPumps,
                pumpTable
            };

            const weatherCache = new Map();
            for (let i = 0; i < 8760; i++) {
                const w = hourlyWeather[i] || { db: 25, wb: 20 };
                const cacheKey = (w.db !== undefined && w.wb !== undefined) ? `${w.db}_${w.wb}` : null;
                let hr = cacheKey !== null ? weatherCache.get(cacheKey) : undefined;
                if (hr === undefined) {
                    hr = calcHourlyEnergy(plantDesign, loadSumm, w, pre);
                    if (cacheKey !== null) weatherCache.set(cacheKey, hr);
                }

                kwh.it += itKw;
                kwh.cduPump += hr.cduPumpKw;
                kwh.crahFan += hr.crahFanKw;
                kwh.heatRejection += hr.heatRejKw;
                kwh.chiller += hr.chillerKw;
                kwh.loss += lossKw;
                waterM3 += hr.waterM3;
                heatRemovedKwh += hr.heatRemovedKw;

                if (hr.isFreeHour) fcHours++;
                if (hr.cduMode && cduModeHours[hr.cduMode] !== undefined) {
                    cduModeHours[hr.cduMode]++;
                }
                if (hr.fwMode && fwModeHours[hr.fwMode] !== undefined) {
                    fwModeHours[hr.fwMode]++;
                }
                if (hr.capacityDeficitKw > 0) {
                    deficitHours++;
                    if (hr.capacityDeficitKw > maxDeficitKw) maxDeficitKw = hr.capacityDeficitKw;
                }
                if (hr.chillerEnvelopeExceeded) {
                    chillerEnvelopeHours++;
                }

                cduKwh.unit += hr.cduKwh.unit;
                cduKwh.pump += hr.cduKwh.pump;
                cduKwh.heatRej += hr.cduKwh.heatRej;
                cduKwh.chiller += hr.cduKwh.chiller;
                fwKwh.crahFan += hr.fwKwh.crahFan;
                fwKwh.heatRej += hr.fwKwh.heatRej;
                fwKwh.chiller += hr.fwKwh.chiller;

                if (onHour) {
                    onHour(i, hr, loadSumm);
                }
            }

            const totalFacKwh = kwh.it + kwh.cduPump + kwh.crahFan + kwh.heatRejection + kwh.chiller + kwh.loss;
            const pue = kwh.it > 0 ? (totalFacKwh / kwh.it).toFixed(3) : '1.000';
            const wue = kwh.it > 0 ? ((waterM3 * 1000) / kwh.it).toFixed(3) : '0.000';

            return {
                kwh,
                cduKwh,
                fwKwh,
                waterM3,
                heatRemovedKwh,
                fcHours,
                deficitHours,
                maxDeficitKw,
                chillerEnvelopeHours,
                totalFacKwh,
                pue: parseFloat(pue),
                wue: parseFloat(wue),
                cduModeHours,
                fwModeHours
            };
        },

        /**
         * Formats the byDu or byCorePod result object from simulation results.
         */
        formatUnitResult(unitMeta, plantDesign, loadSumm, sim) {
            const cduSys = plantDesign.cduSystem;
            const fwSys = plantDesign.fanwallSystem;
            const cduArch = cduSys.architecture || 'dry_cooler_hx';
            const fwArch = fwSys.architecture || 'air_cooled_chiller';

            return {
                ...unitMeta,
                cduArchitecture: cduArch,
                cduSupplyTemp: cduSys.fwsSupplyC,
                cduReturnTemp: cduSys.fwsReturnC,
                fwArchitecture: fwArch,
                fwSupplyTemp: fwSys.chwSupplyC,
                cduModeHours: sim.cduModeHours || { free: 0, partial: 0, mechanical: 0 },
                fwModeHours: sim.fwModeHours || { free: 0, partial: 0, mechanical: 0 },
                totalItKw: loadSumm.totalItKw,
                liquidHeatKw: loadSumm.liquidHeatKw,
                airHeatKw: loadSumm.airHeatKw,
                lossKw: loadSumm.lossKw,
                dlcPct: loadSumm.dlcPct,
                annualPue: sim.pue,
                annualWue: sim.wue,
                annualWaterM3: Math.round(sim.waterM3),
                annualTotalMwh: Math.round(sim.totalFacKwh / 1000),
                annualItMwh: Math.round(sim.kwh.it / 1000),
                fcHours: sim.fcHours,
                deficitHours: sim.deficitHours,
                maxDeficitKw: Math.round(sim.maxDeficitKw),
                chillerEnvelopeHours: sim.chillerEnvelopeHours || 0,
                cduSystemMwh: Math.round((sim.cduKwh.unit + sim.cduKwh.pump + sim.cduKwh.heatRej + sim.cduKwh.chiller) / 1000),
                fwSystemMwh: Math.round((sim.fwKwh.crahFan + sim.fwKwh.heatRej + sim.fwKwh.chiller) / 1000),
                cduUnitKwh: Math.round(sim.cduKwh.unit),
                cduUnitMwh: Math.round(sim.cduKwh.unit / 1000),
                cduPrimaryPumpKwh: Math.round(sim.cduKwh.pump),
                cduKwh: sim.cduKwh,
                cduPumpMwh: Math.round(sim.kwh.cduPump / 1000),
                crahFanMwh: Math.round(sim.kwh.crahFan / 1000),
                heatRejectionMwh: Math.round(sim.kwh.heatRejection / 1000),
                chillerMwh: Math.round(sim.kwh.chiller / 1000),
                lossMwh: Math.round(sim.kwh.loss / 1000)
            };
        },

        /**
         * Calculates energy, thermal, and hydraulic ledgers.
         */
        calculateLedgers(overallKwh, overallTotalKwh, totalLiquidHeatKwh, totalAirHeatKwh, totalHeatRemovedKwh) {
            const hvacTotalKwh = overallKwh.cduPump + overallKwh.crahFan + overallKwh.heatRejection + overallKwh.chiller;
            const totalGenHeatKwh = overallKwh.it + overallKwh.loss;
            const thermalImbalanceKwh = totalGenHeatKwh - totalHeatRemovedKwh;
            const thermalTolKwh = Math.max(1e-3, Math.abs(totalGenHeatKwh) * 1e-6);
            const thermalIsBalanced = Math.abs(thermalImbalanceKwh) < thermalTolKwh;

            const totalPumpEnergyKwh = overallKwh.cduPump;
            const hasAnyCoolingLoad = (totalLiquidHeatKwh + totalAirHeatKwh) > 0;
            const hydraulicIsOk = totalPumpEnergyKwh >= 0 && (!hasAnyCoolingLoad || totalPumpEnergyKwh > 0);

            const energyLedger = {
                it_kwh: overallKwh.it,
                hvac_kwh: hvacTotalKwh,
                loss_kwh: overallKwh.loss,
                facility_total_kwh: overallTotalKwh,
                cdu_pump_kwh: overallKwh.cduPump,
                crah_fan_kwh: overallKwh.crahFan,
                heat_rejection_kwh: overallKwh.heatRejection,
                chiller_kwh: overallKwh.chiller,
                is_balanced: Math.abs(overallTotalKwh - (overallKwh.it + hvacTotalKwh + overallKwh.loss)) < 1e-3
            };

            const thermalLedger = {
                it_heat_kwh: overallKwh.it,
                loss_heat_kwh: overallKwh.loss,
                total_heat_generated_kwh: totalGenHeatKwh,
                liquid_heat_kwh: totalLiquidHeatKwh,
                air_heat_kwh: totalAirHeatKwh,
                total_heat_removed_kwh: totalHeatRemovedKwh,
                imbalance_kwh: thermalImbalanceKwh,
                is_balanced: thermalIsBalanced
            };

            const hydraulicLedger = {
                total_pump_energy_kwh: totalPumpEnergyKwh,
                note: 'partial_sanity_check_only_no_flow_head_model_yet',
                is_hydraulic_ok: hydraulicIsOk
            };

            return { energyLedger, thermalLedger, hydraulicLedger };
        },

        /**
         * Builds the 8760 hourly profile and counts free cooling mode hours.
         */
        buildHourlyProfile(hourlyWeather, hourlyFacilityStats) {
            let cduFreeHours = 0, cduPartialHours = 0, cduMechHours = 0;
            let fwFreeHours = 0, fwPartialHours = 0, fwMechHours = 0;
            let combinedFreeHours = 0, combinedPartialHours = 0, combinedMechHours = 0;
            const hourlyProfile = [];

            for (let i = 0; i < 8760; i++) {
                const w = hourlyWeather[i] || { db: 25, wb: 20 };
                const it = hourlyFacilityStats[i].itKw;
                const tot = hourlyFacilityStats[i].totalKw;
                const chKw = hourlyFacilityStats[i].chillerKw || 0;
                const coolKw = (hourlyFacilityStats[i].coolingNoPumpKw || 0) + (hourlyFacilityStats[i].cduPumpKw || 0);
                const pue = it > 0 ? parseFloat((tot / it).toFixed(3)) : 1.0;

                const cduMode = hourlyFacilityStats[i].cduMode || 'free';
                const fwMode = hourlyFacilityStats[i].fwMode || (chKw > 0 ? 'mechanical' : 'free');
                const combinedMode = (cduMode === 'free' && fwMode === 'free')
                    ? 'free'
                    : ((cduMode === 'mechanical' && fwMode === 'mechanical') ? 'mechanical' : 'partial');

                if (cduMode === 'free') cduFreeHours++;
                else if (cduMode === 'partial') cduPartialHours++;
                else cduMechHours++;

                if (fwMode === 'free') fwFreeHours++;
                else if (fwMode === 'partial') fwPartialHours++;
                else fwMechHours++;

                if (combinedMode === 'free') combinedFreeHours++;
                else if (combinedMode === 'partial') combinedPartialHours++;
                else combinedMechHours++;

                hourlyProfile.push({
                    hourIndex: i,
                    month: hourToMonth(i) + 1,
                    dayOfYear: Math.floor(i / 24) + 1,
                    hourOfDay: i % 24,
                    db: w.db,
                    wb: w.wb,
                    itKw: Math.round(it),
                    pue: pue,
                    mode: cduMode,
                    cduMode: cduMode,
                    fwMode: fwMode,
                    combinedMode: combinedMode,
                    chillerKw: Math.round(chKw),
                    mechLoadKw: Math.round(hourlyFacilityStats[i].mechLoadKw || 0),
                    cduPumpKw: Math.round(hourlyFacilityStats[i].cduPumpKw || 0),
                    coolingKw: Math.round(coolKw),
                    totalKw: Math.round(tot),
                    waterM3: parseFloat(((hourlyFacilityStats[i].waterM3 || 0)).toFixed(4))
                });
            }

            return {
                hourlyProfile,
                cduFcStats: {
                    freeHours: cduFreeHours,
                    freeHoursPct: parseFloat(((cduFreeHours / 8760) * 100).toFixed(1)),
                    partialHours: cduPartialHours,
                    partialHoursPct: parseFloat(((cduPartialHours / 8760) * 100).toFixed(1)),
                    mechHours: cduMechHours,
                    mechHoursPct: parseFloat(((cduMechHours / 8760) * 100).toFixed(1))
                },
                fwFcStats: {
                    freeHours: fwFreeHours,
                    freeHoursPct: parseFloat(((fwFreeHours / 8760) * 100).toFixed(1)),
                    partialHours: fwPartialHours,
                    partialHoursPct: parseFloat(((fwPartialHours / 8760) * 100).toFixed(1)),
                    mechHours: fwMechHours,
                    mechHoursPct: parseFloat(((fwMechHours / 8760) * 100).toFixed(1))
                },
                combinedFcStats: {
                    freeHours: combinedFreeHours,
                    freeHoursPct: parseFloat(((combinedFreeHours / 8760) * 100).toFixed(1)),
                    partialHours: combinedPartialHours,
                    partialHoursPct: parseFloat(((combinedPartialHours / 8760) * 100).toFixed(1)),
                    mechHours: combinedMechHours,
                    mechHoursPct: parseFloat(((combinedMechHours / 8760) * 100).toFixed(1))
                },
                cduFreeHours,
                cduPartialHours,
                cduMechHours
            };
        },

        /**
         * Executes the full annual simulation for all DUs and CorePODs.
         *
         * @param {Object} state - AppStore.state
         * @param {Array} hourlyWeather - 8760 hourly weather array
         * @param {Object} helpers - Store callbacks { calcDuSummary, calcCorePodSummary, bridgeDuToPlantModel, calcHourlyEnergy }
         * @returns {Object} Complete results structure conforming to AppStore.state.results contract
         */
        run(state, hourlyWeather, helpers = {}) {
            const facilityLossPct = state.facilityElectricalLossPct ?? 0.0;
            const byDuResults = [];
            let totalAllItKw = 0;
            let totalAllWaterM3 = 0;
            let totalAllHeatRemovedKwh = 0;
            const overallKwh = { it: 0, cduPump: 0, crahFan: 0, heatRejection: 0, chiller: 0, loss: 0, cduUnitKwh: 0, cduPrimaryPumpKwh: 0 };
            let totalAllCduUnitKwh = 0;
            let totalAllCduPriPumpKwh = 0;
            const monthlyStats = Array.from({ length: 12 }, () => ({ totalKwh: 0, itKwh: 0, coolKwh: 0 }));
            const hourlyFacilityStats = Array.from({ length: 8760 }, () => ({
                itKw: 0,
                totalKw: 0,
                coolingNoPumpKw: 0,
                cduPumpKw: 0,
                chillerKw: 0,
                mechLoadKw: 0,
                waterM3: 0,
                cduMode: 'free',
                fwMode: 'free'
            }));

            const onHour = (i, hr, summ) => {
                const mIdx = hourToMonth(i);
                const hourCoolingNoPump = hr.crahFanKw + hr.heatRejKw + hr.chillerKw;
                const hourCooling = hr.cduPumpKw + hourCoolingNoPump;
                const hourTotal = summ.totalItKw + hourCooling + summ.lossKw;

                monthlyStats[mIdx].totalKwh += hourTotal;
                monthlyStats[mIdx].itKwh += summ.totalItKw;
                monthlyStats[mIdx].coolKwh += hourCooling;

                hourlyFacilityStats[i].itKw += summ.totalItKw;
                hourlyFacilityStats[i].totalKw += hourTotal;
                hourlyFacilityStats[i].coolingNoPumpKw += hourCoolingNoPump;
                hourlyFacilityStats[i].cduPumpKw += hr.cduPumpKw;
                hourlyFacilityStats[i].chillerKw += hr.chillerKw;
                hourlyFacilityStats[i].mechLoadKw = (hourlyFacilityStats[i].mechLoadKw || 0) + (hr.mechLoadKw || 0);
                hourlyFacilityStats[i].waterM3 = (hourlyFacilityStats[i].waterM3 || 0) + (hr.waterM3 || 0);

                if (hr.cduMode === 'mechanical' || (hr.cduMode === 'partial' && hourlyFacilityStats[i].cduMode !== 'mechanical')) {
                    hourlyFacilityStats[i].cduMode = hr.cduMode;
                }
                if (hr.fwMode === 'mechanical' || (hr.fwMode === 'partial' && hourlyFacilityStats[i].fwMode !== 'mechanical')) {
                    hourlyFacilityStats[i].fwMode = hr.fwMode;
                }
            };

            const simHelpers = {
                calcHourlyEnergy: helpers.calcHourlyEnergy,
                onHour
            };

            // 1. Simulate DUs
            (state.halls || []).forEach(hall => {
                (hall.dus || []).forEach(du => {
                    const duSumm = helpers.calcDuSummary ? helpers.calcDuSummary(du) : du;
                    const duLossKw = duSumm.totalItKw * (facilityLossPct / 100);
                    duSumm.lossKw = duLossKw;
                    totalAllItKw += duSumm.totalItKw;

                    if (helpers.bridgeDuToPlantModel) {
                        helpers.bridgeDuToPlantModel(du, duSumm);
                    }

                    const sim = this.simulateUnit(du.plantDesign, duSumm, hourlyWeather, simHelpers);

                    const unitRes = this.formatUnitResult(
                        { duId: du.id, duName: du.name, hallName: hall.name },
                        du.plantDesign,
                        duSumm,
                        sim
                    );
                    byDuResults.push(unitRes);

                    totalAllWaterM3 += sim.waterM3;
                    totalAllCduUnitKwh += sim.cduKwh.unit;
                    totalAllCduPriPumpKwh += (sim.cduKwh.pump || 0);
                    totalAllHeatRemovedKwh += sim.heatRemovedKwh;

                    overallKwh.it += sim.kwh.it;
                    overallKwh.cduPump += sim.kwh.cduPump;
                    overallKwh.crahFan += sim.kwh.crahFan;
                    overallKwh.heatRejection += sim.kwh.heatRejection;
                    overallKwh.chiller += sim.kwh.chiller;
                    overallKwh.loss += sim.kwh.loss;
                });
            });

            // 2. Simulate CorePODs
            const byCorePodResults = [];
            let totalCorePodItKw = 0;
            let totalCorePodTotalKwh = 0;
            let totalCorePodItKwh = 0;
            let totalCorePodWaterM3 = 0;

            (state.corePods || []).filter(p => p.enabled !== false).forEach(pod => {
                const ps = helpers.calcCorePodSummary ? helpers.calcCorePodSummary(pod) : pod;
                const podLossKw = ps.totalItKw * (facilityLossPct / 100);
                ps.lossKw = podLossKw;

                if (helpers.bridgeDuToPlantModel) {
                    helpers.bridgeDuToPlantModel(pod, ps);
                }

                totalCorePodItKw += ps.totalItKw;
                totalAllItKw += ps.totalItKw;

                const sim = this.simulateUnit(pod.plantDesign, ps, hourlyWeather, simHelpers);

                const podRes = this.formatUnitResult(
                    { podId: pod.id, podName: pod.name },
                    pod.plantDesign,
                    ps,
                    sim
                );
                byCorePodResults.push(podRes);

                totalAllWaterM3 += sim.waterM3;
                totalAllCduUnitKwh += sim.cduKwh.unit;
                totalAllCduPriPumpKwh += (sim.cduKwh.pump || 0);
                totalAllHeatRemovedKwh += sim.heatRemovedKwh;
                totalCorePodTotalKwh += sim.totalFacKwh;
                totalCorePodItKwh += sim.kwh.it;
                totalCorePodWaterM3 += sim.waterM3;

                overallKwh.it += sim.kwh.it;
                overallKwh.cduPump += sim.kwh.cduPump;
                overallKwh.crahFan += sim.kwh.crahFan;
                overallKwh.heatRejection += sim.kwh.heatRejection;
                overallKwh.chiller += sim.kwh.chiller;
                overallKwh.loss += sim.kwh.loss;
            });

            overallKwh.cduUnitKwh = Math.round(totalAllCduUnitKwh);
            overallKwh.cduUnit = overallKwh.cduUnitKwh;
            overallKwh.cduPrimaryPumpKwh = Math.round(totalAllCduPriPumpKwh);

            const overallTotalKwh = overallKwh.it + overallKwh.cduPump + overallKwh.crahFan + overallKwh.heatRejection + overallKwh.chiller + overallKwh.loss;
            const overallPue = overallKwh.it > 0 ? (overallTotalKwh / overallKwh.it).toFixed(3) : '1.000';
            const overallP_Pue = overallKwh.it > 0 ? ((overallKwh.it + overallKwh.crahFan + overallKwh.heatRejection + overallKwh.chiller) / overallKwh.it).toFixed(3) : '1.000';
            const overallWue = overallKwh.it > 0 ? ((totalAllWaterM3 * 1000) / overallKwh.it).toFixed(3) : '0.000';

            // Peak PUE and pPUE tracking
            let maxPue = 1.0, maxP_Pue = 1.0;
            let peakMonth = 1, peakHour = 0;
            for (let i = 0; i < 8760; i++) {
                const it = hourlyFacilityStats[i].itKw;
                if (it > 0) {
                    const hPue = hourlyFacilityStats[i].totalKw / it;
                    const hP_Pue = (it + hourlyFacilityStats[i].coolingNoPumpKw) / it;
                    if (hPue > maxPue) {
                        maxPue = hPue;
                        peakMonth = hourToMonth(i) + 1;
                        peakHour = i % 24;
                    }
                    if (hP_Pue > maxP_Pue) {
                        maxP_Pue = hP_Pue;
                    }
                }
            }

            const corePodGroupPue = totalCorePodItKwh > 0 ? parseFloat((totalCorePodTotalKwh / totalCorePodItKwh).toFixed(3)) : 1.000;
            const corePodGroupWue = totalCorePodItKwh > 0 ? parseFloat(((totalCorePodWaterM3 * 1000) / totalCorePodItKwh).toFixed(3)) : 0.000;

            const allUnitDeficitHours = [...byDuResults, ...byCorePodResults].map(r => r.deficitHours || 0);
            const allUnitMaxDeficitKw = [...byDuResults, ...byCorePodResults].map(r => r.maxDeficitKw || 0);
            const allUnitEnvelopeHours = [...byDuResults, ...byCorePodResults].map(r => r.chillerEnvelopeHours || 0);
            const overallDeficitHours = allUnitDeficitHours.length ? Math.max(...allUnitDeficitHours) : 0;
            const overallMaxDeficitKw = allUnitMaxDeficitKw.length ? Math.max(...allUnitMaxDeficitKw) : 0;
            const overallChillerEnvelopeHours = allUnitEnvelopeHours.length ? Math.max(...allUnitEnvelopeHours) : 0;

            const totalLiquidHeatKwh = byDuResults.reduce((s, d) => s + (d.liquidHeatKw * 8760), 0) + byCorePodResults.reduce((s, p) => s + (p.liquidHeatKw * 8760), 0);
            const totalAirHeatKwh = byDuResults.reduce((s, d) => s + (((d.airHeatKw || 0) + (d.lossKw || 0)) * 8760), 0) + byCorePodResults.reduce((s, p) => s + (((p.airHeatKw || 0) + (p.lossKw || 0)) * 8760), 0);

            const { energyLedger, thermalLedger, hydraulicLedger } = this.calculateLedgers(
                overallKwh,
                overallTotalKwh,
                totalLiquidHeatKwh,
                totalAirHeatKwh,
                totalAllHeatRemovedKwh
            );

            const profileResult = this.buildHourlyProfile(hourlyWeather, hourlyFacilityStats);
            const cduFreeHours = profileResult.cduFreeHours;
            const cduPartialHours = profileResult.cduPartialHours;
            const cduMechHours = profileResult.cduMechHours;

            return {
                cduFcStats: profileResult.cduFcStats,
                fwFcStats: profileResult.fwFcStats,
                combinedFcStats: profileResult.combinedFcStats,
                overall: {
                    annualPue: parseFloat(overallPue),
                    annualP_Pue: parseFloat(overallP_Pue),
                    peakPue: parseFloat(maxPue.toFixed(3)),
                    peakP_Pue: parseFloat(maxP_Pue.toFixed(3)),
                    peakMonth: peakMonth,
                    peakHour: peakHour,
                    annualWue: parseFloat(overallWue),
                    annualWaterM3: Math.round(totalAllWaterM3),
                    totalItKw: totalAllItKw,
                    annualTotalMwh: Math.round(overallTotalKwh / 1000),
                    annualItMwh: Math.round(overallKwh.it / 1000),
                    fcHours: cduFreeHours,
                    fcHoursPct: parseFloat(((cduFreeHours / 8760) * 100).toFixed(1)),
                    freeModeHours: cduFreeHours,
                    partialModeHours: cduPartialHours,
                    mechModeHours: cduMechHours,
                    capacityDeficitHours: overallDeficitHours,
                    maxCapacityDeficitKw: overallMaxDeficitKw,
                    chillerEnvelopeHours: overallChillerEnvelopeHours,
                    breakdownKwh: overallKwh,
                    energyLedger,
                    thermalLedger,
                    hydraulicLedger
                },
                byDu: byDuResults,
                byCorePod: byCorePodResults,
                corePodGroup: {
                    annualPue: corePodGroupPue,
                    annualWue: corePodGroupWue,
                    totalItKw: totalCorePodItKw,
                    annualTotalMwh: Math.round(totalCorePodTotalKwh / 1000),
                    annualItMwh: Math.round(totalCorePodItKwh / 1000),
                    annualWaterM3: Math.round(totalCorePodWaterM3)
                },
                fcPotential: {
                    freeHours: cduFreeHours,
                    freeHoursPct: parseFloat(((cduFreeHours / 8760) * 100).toFixed(1)),
                    trimHours: cduPartialHours,
                    trimHoursPct: parseFloat(((cduPartialHours / 8760) * 100).toFixed(1)),
                    mechanicalHours: cduMechHours,
                    mechanicalHoursPct: parseFloat(((cduMechHours / 8760) * 100).toFixed(1))
                },
                monthlyPue: monthlyStats.map((m, idx) => ({
                    month: idx + 1,
                    pue: parseFloat((m.totalKwh / (m.itKwh || 1)).toFixed(3)),
                    coolingMwh: Math.round(m.coolKwh / 1000)
                })),
                hourlyProfile: profileResult.hourlyProfile
            };
        }
    };

    root.AnnualRunner = AnnualRunner;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
