// =============================================================================
// FileName: mapApi.js
// Author: alexppap
// Date: 2026-08-20
// Description: Pixi 地图数据接口层（源 CSS.DashBoard 的 API 模块移植）。
//              六个接口全异步 Promise 化（源为同步 XHR，1518–1602）：
//              QueryFactoryMapInfo / QueryMap / QueryPBSDetailInfo /
//              QueryMaterialDetailInfo / QueryShipDetail /
//              QueryDepartmentAttendanceAndHiddenRisk。
//              与项目现有 plantSiteModelingApi 保持同构；QueryMap 委托
//              plantSiteModelingApi 以复用单一 mock 数据源 mock-map.json。
//              阶段 5.3 完善：sessionStorage 当日缓存对齐源结构——单一
//              saveName 键存组合对象 { time, QueryFactoryMapInfoData,
//              QueryMapData }，默认关闭，由 opts.save + opts.saveName 显式
//              开启，<5MB 体积检查保留（源 setItem 实际被注释，仅存检查）。
// Version: 1.0.0
// =============================================================================
import { plantSiteModelingApi } from "@/api";

// 厂区基础信息：QueryFactoryMapInfo 返回 { status, data: { Angle, LayerIDs, DashedLineLayerIDs } }
// 以 FactoryID 为键，default 为当前唯一厂区配置（1 号厂，角度 -32.5）。
// LayerIDs 推导自 mock-map.json 的图层，若后续 QueryMap 替代数据源需同步本表。
const DEFAULT_FACTORY_INFO = {
  Angle: -32.5, // 厂区旋转角度（度），源 1 号厂配置；QueryMap 实际旋转以本字段为准
  LayerIDs: ["62ea40d2-fa39-438e-b79e-52fc7e1faf47"], // 实线图层
  DashedLineLayerIDs: [], // 虚线图层（当前 mock 无虚线图层）
};
const FACTORY_MAP_INFO = { default: DEFAULT_FACTORY_INFO };

// sessionStorage 当日缓存键前缀（仅 save 开启时写入，saveName 为主键）
const CACHE_KEY_PREFIX = "PixiMapCache:";

// 缓存体积上限（MB，对齐源 <5MB 检查）
const CACHE_MAX_SIZE_MB = 5;

// ---------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------

// 模拟网络延迟，保持异步接口调用形态（对齐 plantSiteModelingApi）
const sleep = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

// 原生 Date 当日字符串（替代源 moment().format("YYYY-MM-DD")，避免 moment 依赖）
const getToday = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// 序列化后 UTF-8 字节数（对齐源 unescape(encodeURIComponent(...)).length 语义）
const sizeInMB = (str) =>
  (typeof Blob !== "undefined" ? new Blob([str]).size : str.length) /
  (1024 * 1024);

/**
 * 读取当日缓存（日期不匹配则视为失效返回 null）
 * @param {string} key 缓存键
 * @returns {object|null} 缓存对象（含 time 与业务负载字段）
 */
const readCache = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj.time !== getToday()) return null; // 非当日缓存失效
    return obj;
  } catch {
    return null;
  }
};

/**
 * 写入当日缓存（体积 <5MB 才写，对齐源实现）
 * @param {string} key 缓存键
 * @param {object} payload 业务负载（与 time 合并存储）
 */
const writeCache = (key, payload) => {
  const raw = JSON.stringify({ time: getToday(), ...payload });
  if (sizeInMB(raw) < CACHE_MAX_SIZE_MB) {
    sessionStorage.setItem(key, raw);
  }
};

// ---------------------------------------------------------------------
// 接口实现
// ---------------------------------------------------------------------

/**
 * 查询厂区基础信息（角度 + 图层 ID 列表）
 * 源：POST /api/TransportManagement/QueryFactoryMapInfo，入参 { FactoryID }
 */
const queryFactoryMapInfo = async (params = {}) => {
  await sleep();
  // FactoryID 决定厂区旋转角度与图层集合；当前 mock 仅一组配置，default 兜底
  const factoryId = params?.FactoryID || "default";
  const factory = FACTORY_MAP_INFO[factoryId] || FACTORY_MAP_INFO.default;
  return { status: 1, data: { ...factory } };
};

/**
 * 查询地图图层详细信息
 * 源：POST /api/Map/QueryMap，入参 { mapLayerIDs: string[], mapStyleType: number }
 * 委托 plantSiteModelingApi.queryMap 复用 mock-map.json（层实线 Polygon 数据）
 */
const queryMap = async (params = {}) => {
  await sleep();
  // 透传 { mapLayerIDs, mapStyleType }；plantSiteModelingApi 当前忽略入参，
  // 待对接真实后端时按 params 过滤/选择图层样式
  const res = await plantSiteModelingApi.queryMap(params);
  return { status: res?.status, data: res?.data };
};

/**
 * 查询 PBS 详情
 * 源：POST /api/TransportManagement/QueryPBSDetailInfo，入参 { PBSIDs: string[] }
 * 返回 data 为数组（PBSOnClick 中 .map 消费）
 */
const queryPBSDetailInfo = async (params = {}) => {
  await sleep(200);
  const { PBSIDs = [] } = params;
  return {
    status: 1,
    data: PBSIDs.map((id, i) => ({
      PBSID: id,
      PBSCode: `PBS-${i + 1}`,
      PbsLayerCode: "MAIN",
      FieldID: null,
      BackgroundColor: "rgba(6, 41, 71, 0.85)",
      Area: 0,
      Weight: 0,
      Remark: "mock 数据",
    })),
  };
};

/**
 * 查询物资详情
 * 源：POST /api/TransportManagement/QueryMaterialDetailInfo，入参 { MaterialIDs: string[] }
 * 返回 data 为数组（materialOnClick 中 .map 消费）
 */
const queryMaterialDetailInfo = async (params = {}) => {
  await sleep(200);
  const { MaterialIDs = [] } = params;
  return {
    status: 1,
    data: MaterialIDs.map((id, i) => ({
      MaterialID: id,
      MaterialCode: `MAT-${i + 1}`,
      MaterialName: "mock 物资",
      BackgroundColor: "rgba(6, 41, 71, 0.85)",
    })),
  };
};

/**
 * 查询船舶详情
 * 源：POST /api/TransportManagement/QueryShipDetail，入参 { ProjectInfoID }
 * 返回 data 为单个对象（shipSpritesOnClick 消费为单项数组）
 */
const queryShipDetail = async (params = {}) => {
  await sleep(200);
  return {
    status: 1,
    data: {
      ShipID: "ship-mock",
      ShipNo: "SHIP-01",
      ShipName: "mock 船舶",
      ProjectInfoID: params.ProjectInfoID || null,
      BuildNo: "H1",
      Remark: "mock 数据",
    },
  };
};

/**
 * 查询部门出勤与隐患
 * 源：POST /api/ComprehensiveBoard/QueryDepartmentAttendanceAndHiddenRisk，
 *     入参 { depID }
 * 返回 data 为单个对象（departmentSpritesOnClick 消费）
 */
const queryDepartmentAttendanceAndHiddenRisk = async (params = {}) => {
  await sleep(200);
  return {
    status: 1,
    data: {
      DepartmentID: params.depID || null,
      DepartmentName: "mock 部门",
      AttendanceCount: 0,
      HiddenRiskCount: 0,
      Remark: "mock 数据",
    },
  };
};

// ---------------------------------------------------------------------
// 组合加载（对应源 asyncloadMapLayer 的两步调用链，含当日缓存）
// ---------------------------------------------------------------------

/**
 * 一次性查询厂区信息 + 地图数据（源 asyncloadMapLayer 1518–1602 调用链移植）
 * 缓存结构对齐源：{ time, QueryFactoryMapInfoData, QueryMapData } 存于单一
 * saveName 键下；opts.save 与 opts.saveName 同时提供才启用（源 setItem 被
 * 注释，默认关闭）。
 * @param {object} [params] 入参
 * @param {string} [params.FactoryID] 厂区 ID
 * @param {number} [params.mapStyleType=3] 地图样式类型
 * @param {object} [opts] 缓存选项
 * @param {boolean} [opts.save] 是否启用缓存
 * @param {string} [opts.saveName] 缓存键名（源 props.saveName）
 * @returns {Promise<object>} { fromCache, factoryInfo, mapInfo }
 *   factoryInfo - QueryFactoryMapInfo 响应 { status, data: { Angle, ... } }
 *   mapInfo - QueryMap 响应 { status, data: { LayerInfos, ... } }（失败为 null）
 */
const loadMapData = async (params = {}, opts = {}) => {
  const { save, saveName } = opts;
  const cacheKey = save && saveName ? CACHE_KEY_PREFIX + saveName : null;

  // 读取当日缓存
  if (cacheKey) {
    const hit = readCache(cacheKey);
    if (hit) {
      return {
        fromCache: true,
        factoryInfo: hit.QueryFactoryMapInfoData,
        mapInfo: hit.QueryMapData,
      };
    }
  }

  // 1. 查询厂区信息（角度 + 图层 ID）
  const factoryInfo = await queryFactoryMapInfo(params);
  if (factoryInfo?.status !== 1) {
    return { fromCache: false, factoryInfo, mapInfo: null };
  }

  // 2. 查询地图数据（实线 + 虚线图层合并，源 mapStyleType 恒 3）
  const mapInfo = await queryMap({
    mapLayerIDs: (factoryInfo.data.LayerIDs || []).concat(
      factoryInfo.data.DashedLineLayerIDs || []
    ),
    mapStyleType: params.mapStyleType ?? 3,
  });

  // 3. 写入当日缓存（<5MB 才写；源 setItem 被注释，save 开启时恢复写入）
  if (cacheKey && mapInfo?.status === 1) {
    writeCache(cacheKey, {
      QueryFactoryMapInfoData: factoryInfo,
      QueryMapData: mapInfo,
    });
  }

  return { fromCache: false, factoryInfo, mapInfo };
};

// ---------------------------------------------------------------------
// 统一导出
// ---------------------------------------------------------------------
const mapApi = {
  queryFactoryMapInfo,
  queryMap,
  queryPBSDetailInfo,
  queryMaterialDetailInfo,
  queryShipDetail,
  queryDepartmentAttendanceAndHiddenRisk,
  loadMapData,
};

export default mapApi;
