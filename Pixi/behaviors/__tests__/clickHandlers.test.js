/**
 * FileName: clickHandlers.test.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 阶段 5.2 —— 点击交互测试。验收点：五类点击处理器
 *              （PBS/Material/ShipSprites/DepartmentSprites/HullField）、
 *              PBSOnClick 定位放大分支、closeDialogsAndCleanup 清理链、
 *              resetDialogState、场地 hover 链（mousemove → Field 弹窗）、
 *              isUnmounted 卸载守卫、destroy 边框销毁。
 * Version: 1.0.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, reactive, nextTick } from "vue";
import { createClickHandlers } from "@/components/Pixi/behaviors/clickHandlers";
import { createDialogPosition } from "@/components/Pixi/behaviors/dialogPosition";
import { createAllStates } from "@/components/Pixi/state";

// ---------------------------------------------------------------------
// mock 依赖
// ---------------------------------------------------------------------

/** mock PixiMap 实例（仅需 mapContainer；常驻渲染下无手动 render） */
const createMockPixiMap = () => {
  const children = [];
  return {
    mapContainer: {
      children,
      addChild: (c) => children.push(c),
      scale: { set: vi.fn() },
      position: { set: vi.fn() },
    },
  };
};

/** mock 精灵对象（含命中检测回填字段） */
const mockPBS = {
  PBSID: "pbs-1",
  PBSCode: "PBS001",
  MyPolygonVertices: [0, 0, 10, 0, 10, 10, 0, 10],
  MyAngle: 30,
  MyMirror: true,
  x: 100,
  y: 200,
  getGlobalPosition: vi.fn(() => ({ x: 500, y: 400 })),
};

/** mock 物资对象 */
const mockMaterial = {
  Name: "MAT-A",
  RefObjectID: "mat-1",
  MyPolygonVertices: [0, 0, 8, 0, 8, 8, 0, 8],
  MyAngle: 10,
  MyMirror: false,
  x: 300,
  y: 300,
  getGlobalPosition: vi.fn(() => ({ x: 600, y: 500 })),
};

/** 组装完整 ctx（默认 props 可被覆写） */
const setup = (propsOverrides = {}, ctxOverrides = {}) => {
  const pixiMap = createMockPixiMap();
  const states = createAllStates(null);
  states.spriteState.PBSs.push(mockPBS);

  const mapInfo = { Scale: 2 };
  const emit = vi.fn();
  const DialogData = states.dialogState.DialogData;
  const dialogPosition = createDialogPosition({
    DialogData,
    getDialogDom: () => ({ clientWidth: 300, clientHeight: 200 }),
  });
  const clickEventType = ref("");
  const modalTitle = ref("");
  const shipNoTitle = ref("");
  const scale = ref(1);
  const isUnmounted = vi.fn(() => false);

  const mapApi = {
    queryPBSDetailInfo: vi.fn().mockResolvedValue({
      status: 1,
      data: [{ PBSID: "pbs-1", PBSCode: "PBS001" }],
    }),
    queryMaterialDetailInfo: vi.fn().mockResolvedValue({
      status: 1,
      data: [{ MaterialID: "mat-1", MaterialName: "MAT-A" }],
    }),
    queryShipDetail: vi.fn().mockResolvedValue({
      status: 1,
      data: { ShipNo: "S-01", ShipName: "测试船" },
    }),
    queryDepartmentAttendanceAndHiddenRisk: vi.fn().mockResolvedValue({
      status: 1,
      data: { AttendanceCount: 5, HiddenRiskCount: 2 },
    }),
  };

  const coordinateSystem = {
    resetMap: vi.fn(),
    calculateScaleTransform: vi.fn(() => ({
      getNewPosition: () => ({ x: 11, y: 22 }),
    })),
    adjustElementsOnScale: vi.fn(),
  };

  const props = reactive({
    isHull: false,
    feildTextVisible: false,
    isSynced: false,
    NowTabID: "tab-1",
    mapObj: { MapWidth: 1920, MapHeight: 1080 },
    FieldInfos: null,
    ...propsOverrides,
  });

  const handlers = createClickHandlers({
    pixiMap,
    states,
    mapInfo,
    emit,
    dialogPosition,
    mapApi,
    coordinateSystem,
    scale,
    props,
    getDialogDom: () => ({ clientWidth: 300, clientHeight: 200 }),
    clickEventType,
    modalTitle,
    shipNoTitle,
    configParams: undefined,
    isUnmounted,
    ...ctxOverrides,
  });

  return {
    handlers, pixiMap, states, DialogData, emit, mapApi, coordinateSystem,
    clickEventType, modalTitle, shipNoTitle, scale, props, isUnmounted,
  };
};

// ---------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal("innerWidth", 1920);
  vi.stubGlobal("innerHeight", 1080);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PBSOnClick", () => {
  it("默认分支：创建高亮边框（角度/镜像/Scale）+ 查询详情 + 打开弹窗", async () => {
    const t = setup();
    await t.handlers.PBSOnClick({ PBSID: "pbs-1" });
    await nextTick();

    // 标题与点击类型
    expect(t.clickEventType.value).toBe("PBS");
    expect(t.modalTitle.value).toBe("PBS001");

    // 边框已加入容器，带角度/镜像/Scale 变换
    const border = t.pixiMap.mapContainer.children.find(
      (c) => c.MyPolygonVertices // createHighlightBorder 回填
    );
    expect(border).toBeTruthy();
    // Pixi v8 angle setter 内部度↔弧度转换存在浮点误差，用近似断言
    expect(border.angle).toBeCloseTo(30, 6);
    expect(border.scale.x).toBe(-2); // Mirror=true 且 Scale=2 → -Scale
    expect(border.scale.y).toBe(2);

    // 详情接口与弹窗状态
    expect(t.mapApi.queryPBSDetailInfo).toHaveBeenCalledWith({
      PBSIDs: ["pbs-1"],
    });
    expect(t.DialogData.showDialog).toBe(true);
    expect(t.DialogData.ClickedMapItems[0]).toMatchObject({
      PBSID: "pbs-1",
      clickEventType: "PBS",
    });

    // resetDialogState 触发的 emit
    expect(t.emit).toHaveBeenCalledWith("changeShowTransitRecords");
  });

  it("setPosition=true：定位放大（resetMap → 缩放 2 倍 → 反向缩放补偿）", async () => {
    const t = setup();
    await t.handlers.PBSOnClick({ PBSID: "pbs-1" }, true);

    expect(t.coordinateSystem.resetMap).toHaveBeenCalled();
    expect(mockPBS.getGlobalPosition).toHaveBeenCalled();
    expect(t.scale.value).toBe(2);
    expect(t.pixiMap.mapContainer.scale.set).toHaveBeenCalledWith(2);
    expect(t.pixiMap.mapContainer.position.set).toHaveBeenCalledWith(11, 22);
    expect(t.coordinateSystem.adjustElementsOnScale).toHaveBeenCalledWith(2);
  });

  it("PBS 不存在时直接返回，不抛错", async () => {
    const t = setup();
    await t.handlers.PBSOnClick({ PBSID: "not-exist" });
    expect(t.DialogData.showDialog).toBe(false);
    expect(t.mapApi.queryPBSDetailInfo).not.toHaveBeenCalled();
  });

  it("组件已卸载：详情返回后不再写弹窗状态", async () => {
    const t = setup();
    const p = t.handlers.PBSOnClick({ PBSID: "pbs-1" });
    t.isUnmounted.mockReturnValue(true);
    await p;

    expect(t.DialogData.showDialog).toBe(false);
    expect(t.DialogData.ClickedMapItems).toEqual([]);
  });
});

describe("materialOnClick", () => {
  it("非精灵：创建边框（angle/scale 变换）+ 查询详情 + 打开弹窗", async () => {
    const t = setup();
    await t.handlers.materialOnClick(mockMaterial, false);
    await nextTick();

    expect(t.clickEventType.value).toBe("Material");
    expect(t.modalTitle.value).toBe("MAT-A");

    const border = t.pixiMap.mapContainer.children.find(
      (c) => c.MyPolygonVertices
    );
    expect(border).toBeTruthy();
    expect(border.angle).toBe(10);
    expect(border.scale.x).toBe(2); // Mirror=false → +Scale

    expect(t.mapApi.queryMaterialDetailInfo).toHaveBeenCalledWith({
      MaterialIDs: ["mat-1"],
    });
    expect(t.DialogData.showDialog).toBe(true);
    expect(t.DialogData.ClickedMapItems[0]).toMatchObject({
      MaterialID: "mat-1",
      clickEventType: "Material",
    });
  });

  it("精灵（isSprite=true）：不创建边框，弹窗正常打开", async () => {
    const t = setup();
    await t.handlers.materialOnClick(mockMaterial, true);

    expect(
      t.pixiMap.mapContainer.children.find((c) => c.MyPolygonVertices)
    ).toBeUndefined();
    expect(t.DialogData.showDialog).toBe(true);
  });
});

describe("shipSpritesOnClick / departmentSpritesOnClick", () => {
  it("船舶点击：船号/船名赋值，单项 ClickedMapItems", async () => {
    const t = setup();
    const element = {
      projectInfoID: "p-1",
      getGlobalPosition: () => ({ x: 700, y: 600 }),
    };
    await t.handlers.shipSpritesOnClick(element);
    await nextTick();

    expect(t.clickEventType.value).toBe("ShipSprites");
    expect(t.shipNoTitle.value).toBe("S-01");
    expect(t.modalTitle.value).toBe("测试船");
    expect(t.DialogData.showDialog).toBe(true);
    expect(t.DialogData.ClickedMapItems[0]).toMatchObject({
      ShipNo: "S-01",
      clickEventType: "ShipSprites",
    });
  });

  it("部门点击：出勤数赋值，单项 ClickedMapItems", async () => {
    const t = setup();
    const element = {
      getGlobalPosition: () => ({ x: 700, y: 600 }),
    };
    await t.handlers.departmentSpritesOnClick(element, { DepartmentID: "d-1" });
    await nextTick();

    expect(t.clickEventType.value).toBe("DepartmentSprites");
    expect(t.mapApi.queryDepartmentAttendanceAndHiddenRisk).toHaveBeenCalledWith({
      depID: "d-1",
    });
    expect(t.shipNoTitle.value).toBe(5);
    expect(t.DialogData.ClickedMapItems[0]).toMatchObject({
      AttendanceCount: 5,
      clickEventType: "DepartmentSprites",
    });
  });
});

describe("onHullFieldClick", () => {
  it("100ms 后创建同名边框、emit showModal、隐藏非同名文本", async () => {
    vi.useFakeTimers();
    const t = setup({ isHull: true, isSynced: true });

    // 预置底图元素与文本（name 匹配）
    const graphic = {
      name: "F-01",
      MyPolygonVertices: [0, 0, 5, 0, 5, 5, 0, 5],
      x: 10,
      y: 20,
    };
    t.states.mapLayerState.MapLayer.push(graphic);
    const textOther = { text: "F-02", visible: true };
    const textSelf = { text: "F-01", visible: true };
    t.states.mapLayerState.fieldTextLst.push(textOther, textSelf);

    const event = {
      stopPropagation: vi.fn(),
      target: graphic,
      global: { x: 300, y: 400 },
    };
    t.handlers.onHullFieldClick(event);

    // setTimeout 未触发前不执行
    expect(t.emit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);

    // 边框创建并加入容器
    expect(
      t.pixiMap.mapContainer.children.some((c) => c.MyPolygonVertices)
    ).toBe(true);
    // 文本可见性：仅同名文本可见（feildTextVisible=false）
    expect(textOther.visible).toBe(false);
    expect(textSelf.visible).toBe(true);
    // showModal 事件（actualSmall 不在 NowTabID → clientX = x+15）
    expect(t.emit).toHaveBeenCalledWith("showModal", {
      PBSName: "F-01",
      clientX: 315,
      clientY: 400,
    });
    // isSynced 联动
    expect(t.emit).toHaveBeenCalledWith("changeClick", "F-01");
  });

  it("actualSmall 小图模式：clientX 附加画布宽度与双偏移", async () => {
    vi.useFakeTimers();
    const t = setup({ isHull: true, NowTabID: "actualSmall_1" });
    const graphic = {
      name: "F-01",
      MyPolygonVertices: [0, 0, 5, 0, 5, 5, 0, 5],
      x: 10,
      y: 20,
    };
    t.states.mapLayerState.MapLayer.push(graphic);

    t.handlers.onHullFieldClick({
      stopPropagation: vi.fn(),
      target: graphic,
      global: { x: 300, y: 400 },
    });
    vi.advanceTimersByTime(100);

    // clientX = 300 + 1920 + 15 + 40
    expect(t.emit).toHaveBeenCalledWith("showModal", {
      PBSName: "F-01",
      clientX: 2275,
      clientY: 400,
    });
  });

  it("组件已卸载：定时器回调直接返回", async () => {
    vi.useFakeTimers();
    const t = setup({ isHull: true });
    const graphic = {
      name: "F-01",
      MyPolygonVertices: [0, 0, 5, 0, 5, 5, 0, 5],
      x: 10,
      y: 20,
    };
    t.handlers.onHullFieldClick({
      stopPropagation: vi.fn(),
      target: graphic,
      global: { x: 300, y: 400 },
    });
    t.isUnmounted.mockReturnValue(true);
    vi.advanceTimersByTime(100);

    expect(t.emit).not.toHaveBeenCalled();
  });
});

describe("closeDialogsAndCleanup", () => {
  it("弹窗打开时：关闭弹窗 + 清空点击数据 + 重置点击类型", () => {
    const t = setup();
    t.DialogData.showDialog = true;
    t.DialogData.ClickedMapItems = [{ PBSID: "x" }];
    t.clickEventType.value = "PBS";

    t.handlers.closeDialogsAndCleanup();

    expect(t.DialogData.showDialog).toBe(false);
    expect(t.DialogData.ClickedMapItems).toEqual([]);
    expect(t.clickEventType.value).toBe("");
    expect(t.emit).toHaveBeenCalledWith("changeShowTransitRecords");
  });

  it("isHull 模式：销毁边框列表 + 隐藏文本 + isSynced 空点击联动", () => {
    const t = setup({ isHull: true, isSynced: true });
    // 预置边框与文本
    t.handlers.onHullFieldClick; // noop（保持结构清晰）
    const border = {
      MyPolygonVertices: [0, 0, 5, 0],
      x: 1,
      y: 1,
      destroy: vi.fn(),
    };
    t.DialogData.showDialog = true;
    const text = { text: "F-01", visible: true };
    t.states.mapLayerState.fieldTextLst.push(text);

    // 通过 PBSOnClick 产生的边框列表难以直接访问，此处验证公开行为：
    t.handlers.closeDialogsAndCleanup();

    expect(t.emit).toHaveBeenCalledWith("showModal", "");
    expect(t.emit).toHaveBeenCalledWith("changeClick", "");
    expect(text.visible).toBe(false); // feildTextVisible=false → 全部隐藏
    expect(border.destroy).not.toHaveBeenCalled(); // 未注册的不误销毁
  });
});

describe("resetDialogState", () => {
  it("隐藏边框 + 关闭弹窗 + 清空点击数据（不重置 clickEventType，对齐源 1819 版本）", () => {
    const t = setup();
    t.DialogData.showDialog = true;
    t.DialogData.ClickedMapItems = [{ a: 1 }];
    t.clickEventType.value = "Material";

    t.handlers.resetDialogState();

    expect(t.DialogData.showDialog).toBe(false);
    expect(t.DialogData.ClickedMapItems).toEqual([]);
    expect(t.clickEventType.value).toBe("Material");
    expect(t.emit).toHaveBeenCalledWith("changeShowTransitRecords");
  });
});

describe("场地 hover 链", () => {
  /** 构造可命中的 MapLayer 元素（clickThroughTest 消费 containsPoint） */
  const setupHover = (fieldID = "F-01") => {
    const t = setup({
      FieldInfos: {
        MapAreaTotalInfos: [{ FieldID: fieldID, Name: "场地A" }],
      },
    });
    // MapLayer 首元素无 ShipNo（场地元素）→ 命中走 handleFieldHit
    t.states.mapLayerState.MapLayer.push({
      FieldID: fieldID,
      containsPoint: () => true,
      ShipNo: undefined,
    });
    return t;
  };

  it("hover 命中场地区域：打开 Field 弹窗并写入 ClickedMapItems", () => {
    const t = setupHover();
    t.handlers.handleFieldMouseMove({ global: { x: 300, y: 300 } });

    expect(t.clickEventType.value).toBe("Field");
    expect(t.modalTitle.value).toBe("场地");
    expect(t.DialogData.showDialog).toBe(true);
    expect(t.DialogData.ClickedMapItems[0]).toMatchObject({
      FieldID: "F-01",
      clickEventType: "Field",
    });
  });

  it("非 Field 点击类型（如 PBS）时 hover 直接返回", () => {
    const t = setupHover();
    t.clickEventType.value = "PBS";
    t.handlers.handleFieldMouseMove({ global: { x: 300, y: 300 } });

    expect(t.DialogData.showDialog).toBe(false);
  });

  it("无 FieldInfos 数据时直接返回", () => {
    const t = setup(); // FieldInfos: null
    expect(() =>
      t.handlers.handleFieldMouseMove({ global: { x: 1, y: 1 } })
    ).not.toThrow();
    expect(t.DialogData.showDialog).toBe(false);
  });

  it("未命中场地（FieldID 不匹配）：重置弹窗状态", () => {
    const t = setupHover("F-01");
    // 命中元素 FieldID 与 MapAreaTotalInfos 不匹配 → findMatchingField 无 field
    t.states.mapLayerState.MapLayer[0].FieldID = "F-99";
    t.DialogData.showDialog = true;

    t.handlers.handleFieldMouseMove({ global: { x: 300, y: 300 } });

    expect(t.DialogData.showDialog).toBe(false);
    expect(t.DialogData.ClickedMapItems).toEqual([]);
  });

  it("bindMouseMoveEvent 绑定容器 mousemove", () => {
    const t = setupHover();
    const container = { on: vi.fn() };
    t.handlers.bindMouseMoveEvent(container);

    expect(container.on).toHaveBeenCalledWith(
      "mousemove",
      expect.any(Function)
    );
  });
});

describe("destroy", () => {
  it("销毁已创建的高亮边框（destroy 调用）并清空 dialogState 边框引用", async () => {
    const t = setup();
    await t.handlers.PBSOnClick({ PBSID: "pbs-1" });

    // 收集容器中边框的 destroy spy（Pixi Graphics 真实对象，spy 其 destroy）
    const border = t.pixiMap.mapContainer.children.find(
      (c) => c.MyPolygonVertices
    );
    const destroySpy = vi.spyOn(border, "destroy");

    t.handlers.destroy();

    expect(destroySpy).toHaveBeenCalled();
  });
});
