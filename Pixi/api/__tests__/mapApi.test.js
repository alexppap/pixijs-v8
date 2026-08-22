// =============================================================================
// FileName: mapApi.test.js
// Author: alexppap
// Date: 2026-08-20
// Description: 阶段 0 验收测试 —— Pixi 地图接口骨架 + 纹理资产。
//              验证六个 mapApi 接口返回结构与源 MapTemplate 消费字段一致；
//              验证资产可被 vite 导入（别名 @/components/Pixi/assets 生效）。
//              阶段 5.3 追加：loadMapData 组合加载 + sessionStorage 当日缓存
//              （默认关闭，save+saveName 开启，<5MB 检查，非当日失效）。
// Version: 1.0.0
// =============================================================================
import { describe, it, expect, beforeEach } from 'vitest';
import mapApi from '@/components/Pixi/api/mapApi';

// ---- 纹理资产可被 vite 导入（验收：资产可被 vite 导入） ----
import cameraPng from '@/components/Pixi/assets/imgs/camera.png';
import shipPositionPng from '@/components/Pixi/assets/imgs/shipPosition.png';
import departmentPositionPng from '@/components/Pixi/assets/imgs/departmentPosition.png';
import pingbanchePng from '@/components/Pixi/assets/imgs/pingbanche.png';
import pingbanchecePng from '@/components/Pixi/assets/imgs/pingbanchece.png';
import arrowBluePng from '@/components/Pixi/assets/imgs/arrow-blue.png';
import positionPng from '@/components/Pixi/assets/imgs/position.png';
import positionJson from '@/components/Pixi/assets/imgs/position.json';

describe('阶段0 纹理资产导入', () => {
  it('六张单图 + position 雪碧图均可被 vite 导入为非空资源 URL', () => {
    const urls = [
      cameraPng,
      shipPositionPng,
      departmentPositionPng,
      pingbanchePng,
      pingbanchecePng,
      arrowBluePng,
      positionPng,
    ];
    urls.forEach((u) => expect(u).toBeTruthy());
  });

  it('position.json 包含 60 帧有序帧数据且尺寸与 position.png meta 一致', () => {
    const frames = Object.keys(positionJson.frames);
    expect(frames.length).toBe(60);
    // 帧有序：frame 前缀 + 递增序号
    expect(frames[0]).toBe('frame1');
    expect(frames[59]).toBe('frame60');
    // 单帧 60x30（与修复源码一致）
    expect(positionJson.frames.frame1.frame).toEqual({ x: 0, y: 0, w: 60, h: 30 });
    // 末帧 x = 3540，雪碧图总宽 3600
    expect(positionJson.frames.frame60.frame.x).toBe(3540);
    expect(positionJson.meta.size).toEqual({ w: 3600, h: 30 });
  });
});

describe('阶段0 mapApi 接口骨架', () => {
  it('QueryFactoryMapInfo 返回 { status, data: { Angle, LayerIDs, DashedLineLayerIDs } }', async () => {
    const res = await mapApi.queryFactoryMapInfo({ FactoryID: 'x' });
    expect(res.status).toBe(1);
    expect(typeof res.data.Angle).toBe('number');
    expect(Array.isArray(res.data.LayerIDs)).toBe(true);
    expect(Array.isArray(res.data.DashedLineLayerIDs)).toBe(true);
  });

  it('QueryMap 返回 { status, data: { Scale, MapWidth, MapHeight, LayerInfos } }，LayerInfos 含 Polygon/虚线字段', async () => {
    const res = await mapApi.queryMap();
    expect(res.status).toBe(1);
    const d = res.data;
    expect(typeof d.Scale).toBe('number');
    expect(typeof d.MapWidth).toBe('number');
    expect(typeof d.MapHeight).toBe('number');
    expect(Array.isArray(d.LayerInfos)).toBe(true);
    expect(d.LayerInfos.length).toBeGreaterThan(0);
    // 验证解析字段可被 layer.js 消费：元素带 Type/MapPoints/FillColor/BorderColor
    const el = d.LayerInfos[0].Elements[0];
    expect(['Polygon', 'PolyLine']).toContain(el.Type);
    expect(Array.isArray(el.MapPoints)).toBe(true);
    expect(typeof el.FillColor).toBe('number');
  });

  it('QueryPBSDetailInfo 返回数组，含 PBSID/PBSCode/PbsLayerCode/FieldID/BackgroundColor', async () => {
    const res = await mapApi.queryPBSDetailInfo({ PBSIDs: ['a', 'b'] });
    expect(res.status).toBe(1);
    expect(res.data.length).toBe(2);
    const row = res.data[0];
    expect(row.PBSID).toBe('a');
    expect(typeof row.PBSCode).toBe('string');
    expect('BackgroundColor' in row).toBe(true);
  });

  it('QueryMaterialDetailInfo 返回数组，含 MaterialID/BackgroundColor', async () => {
    const res = await mapApi.queryMaterialDetailInfo({ MaterialIDs: ['m1'] });
    expect(res.status).toBe(1);
    expect(res.data[0].MaterialID).toBe('m1');
    expect('BackgroundColor' in res.data[0]).toBe(true);
  });

  it('QueryShipDetail 返回单个对象，含 ShipNo/ShipName/ShipID (shipSpritesOnClick 消费)', async () => {
    const res = await mapApi.queryShipDetail({ ProjectInfoID: 'p1' });
    expect(res.status).toBe(1);
    expect(res.data.ProjectInfoID).toBe('p1');
    expect(typeof res.data.ShipNo).toBe('string');
    expect(typeof res.data.ShipName).toBe('string');
  });

  it('QueryDepartmentAttendanceAndHiddenRisk 返回对象，含 AttendanceCount (departmentSpritesOnClick 消费)', async () => {
    const res = await mapApi.queryDepartmentAttendanceAndHiddenRisk({ depID: 'd1' });
    expect(res.status).toBe(1);
    expect(res.data.DepartmentID).toBe('d1');
    expect(typeof res.data.AttendanceCount).toBe('number');
  });
});

describe('阶段5.3 loadMapData 组合加载与当日缓存', () => {
  const CACHE_KEY = 'PixiMapCache:test-save';

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('默认不启用缓存：不写 sessionStorage，fromCache=false', async () => {
    const result = await mapApi.loadMapData({ FactoryID: 'f1' });

    expect(result.fromCache).toBe(false);
    expect(result.factoryInfo.status).toBe(1);
    expect(result.factoryInfo.data.Angle).toBe(-32.5);
    expect(result.mapInfo.status).toBe(1);
    expect(result.mapInfo.data.LayerInfos.length).toBeGreaterThan(0);
    // 未传 save/saveName → 不写缓存
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('save+saveName 开启：首次请求后写入缓存，二次命中 fromCache=true', async () => {
    const opts = { save: true, saveName: 'test-save' };

    const first = await mapApi.loadMapData({ FactoryID: 'f1' }, opts);
    expect(first.fromCache).toBe(false);
    // 缓存结构对齐源：{ time, QueryFactoryMapInfoData, QueryMapData }
    const raw = sessionStorage.getItem(CACHE_KEY);
    expect(raw).toBeTruthy();
    const cached = JSON.parse(raw);
    expect(cached.time).toBeTruthy();
    expect(cached.QueryFactoryMapInfoData.status).toBe(1);
    expect(cached.QueryMapData.status).toBe(1);

    // 二次加载命中当日缓存
    const second = await mapApi.loadMapData({ FactoryID: 'f1' }, opts);
    expect(second.fromCache).toBe(true);
    expect(second.factoryInfo.data.Angle).toBe(-32.5);
    expect(second.mapInfo.data.LayerInfos.length).toBeGreaterThan(0);
  });

  it('非当日缓存失效：time 不匹配时重新请求', async () => {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        time: '2000-01-01',
        QueryFactoryMapInfoData: { status: 1, data: { Angle: 999 } },
        QueryMapData: { status: 1, data: { LayerInfos: [] } },
      })
    );

    const result = await mapApi.loadMapData(
      { FactoryID: 'f1' },
      { save: true, saveName: 'test-save' }
    );
    expect(result.fromCache).toBe(false);
    expect(result.factoryInfo.data.Angle).not.toBe(999); // 旧缓存未命中
  });

  it('仅 save 无 saveName：不启用缓存（源 setItem 注释语义，双条件开启）', async () => {
    const result = await mapApi.loadMapData(
      { FactoryID: 'f1' },
      { save: true }
    );
    expect(result.fromCache).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });
});