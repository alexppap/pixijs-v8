/**
 * FileName: dialogPosition.test.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 阶段 5.1 —— 弹窗定位测试。验收点：CLICK_CONFIG 常量、
 *              adjustDialogAndLine（正常/Y 溢出上移/X 溢出左移/角度）、
 *              calculateDialogPosition（getDialogDom 注入）、
 *              getDialogYOffset（ConfigParams 各分支）。
 * Version: 1.0.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nextTick } from "vue";
import {
  createDialogPosition,
  CLICK_CONFIG,
} from "@/components/Pixi/behaviors/dialogPosition";

/** 构造 mock DOM（可控 clientWidth/clientHeight） */
const mockDom = (w = 300, h = 200) => ({ clientWidth: w, clientHeight: h });

describe("CLICK_CONFIG 常量", () => {
  it("包含边框样式/弹窗偏移/连接线调整/模板魔法数四组配置", () => {
    expect(CLICK_CONFIG.BORDER_STYLE.NORMAL).toEqual({ width: 1, color: 0x30ffff });
    expect(CLICK_CONFIG.BORDER_STYLE.HIGHLIGHT).toEqual({ width: 2, color: 0x30ffff });
    expect(CLICK_CONFIG.DIALOG_OFFSET.DEFAULT_Y).toBe(20);
    expect(CLICK_CONFIG.DIALOG_OFFSET.LEGEND_STYLE_Y).toBe(100);
    expect(CLICK_CONFIG.DIALOG_OFFSET.COLUMN_CHART_1_Y).toBe(180);
    expect(CLICK_CONFIG.DIALOG_OFFSET.COLUMN_CHART_2_Y).toBe(190);
    expect(CLICK_CONFIG.DIALOG_OFFSET.X_ADJUST).toBe(175);
    expect(CLICK_CONFIG.LINE_ADJUST.DELTA_X).toBe(150);
    expect(CLICK_CONFIG.LINE_ADJUST.DELTA_Y).toBe(-50);
    // 模板层魔法数（源模板 1–214 硬编码集中）
    expect(CLICK_CONFIG.TEMPLATE.LINE_TOP_MAP_HEIGHT_BASE).toBe(1125);
    expect(CLICK_CONFIG.TEMPLATE.DIALOG_LEFT_ADJUST).toBe(175);
    expect(CLICK_CONFIG.TEMPLATE.DIALOG_TOP_ADJUST).toBe(-70);
  });
});

describe("adjustDialogAndLine", () => {
  let DialogData;

  beforeEach(() => {
    DialogData = {
      DialogX: 0, DialogY: 0, lineX: 0, lineY: 0, lineLength: 0, lineDeg: 0,
    };
    // 固定视口尺寸（jsdom 默认 1024x768，显式 stub 保证断言稳定）
    vi.stubGlobal("innerWidth", 1920);
    vi.stubGlobal("innerHeight", 1080);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("无溢出：初始位置 = 点击点 + 偏移，连接线按 DELTA 计算", async () => {
    const dp = createDialogPosition({ DialogData });
    dp.adjustDialogAndLine(mockDom(300, 200), { x: 500, y: 400 }, { yOffset: 20 });

    expect(DialogData.DialogX).toBe(500);
    expect(DialogData.DialogY).toBe(420);

    await nextTick();
    // restHeight = 1080 - 420 - 100 = 560 > 200 → 无 Y 溢出
    // restWidth = 1920 - 500 - 200 = 1220 > 300 → 无 X 溢出
    // deltaY=-50, deltaX=150 → lineY=(420*2-50)/2, lineX=(500*2+150)/2
    expect(DialogData.lineY).toBe((420 * 2 - 50) / 2);
    expect(DialogData.lineX).toBe((500 * 2 + 150) / 2);
    expect(DialogData.lineLength).toBe(Math.sqrt(150 * 150 + 50 * 50));
    // 角度 = atan2(-50, 150) 转 deg（约 -18.43°）
    expect(DialogData.lineDeg).toBeCloseTo(-18.43, 1);
  });

  it("Y 轴溢出：DialogY 上移 moveHeight，deltaY 同步扣减", async () => {
    const dp = createDialogPosition({ DialogData });
    // 视口 1080，DialogY=1000 + 20 = 1020 → restHeight = 1080-1020-100 = -40 < 200
    dp.adjustDialogAndLine(mockDom(300, 200), { x: 100, y: 1000 }, { yOffset: 20 });
    await nextTick();

    const moveHeight = 200 - (1080 - 1020 - 100); // 240
    expect(DialogData.DialogY).toBe(1020 - 240);
    // deltaY = -50 - 240 = -290，lineY = (DialogY*2 + deltaY)/2 + moveHeight
    const deltaY = -50 - moveHeight;
    expect(DialogData.lineY).toBe((DialogData.DialogY * 2 + deltaY) / 2 + moveHeight);
  });

  it("X 轴溢出：DialogX 左移 moveWidth，deltaX 同步扣减", async () => {
    const dp = createDialogPosition({ DialogData });
    // DialogX = 1800 → restWidth = 1920-1800-200 = -80 < 300
    dp.adjustDialogAndLine(mockDom(300, 200), { x: 1800, y: 400 }, { yOffset: 20 });
    await nextTick();

    const moveWidth = 300 - (1920 - 1800 - 200); // 380
    expect(DialogData.DialogX).toBe(1800 - moveWidth);
    const deltaX = 150 - moveWidth;
    expect(DialogData.lineX).toBe((DialogData.DialogX * 2 + deltaX) / 2 + moveWidth);
  });

  it("dom 为 null：仍写入初始位置，测量分支跳过", async () => {
    const dp = createDialogPosition({ DialogData });
    dp.adjustDialogAndLine(null, { x: 100, y: 200 }, { yOffset: 0 });

    expect(DialogData.DialogX).toBe(100);
    expect(DialogData.DialogY).toBe(200);

    await nextTick();
    expect(DialogData.lineX).toBe(0); // 未测量，连接线保持初始值
    expect(DialogData.lineLength).toBe(0);
  });

  it("角度 ≤ -90° 时归一化为 360+angle（连接线朝左上）", async () => {
    const dp = createDialogPosition({ DialogData });
    // deltaX 大幅负（X 溢出 800+），deltaY 负 → 角度 < -90
    dp.adjustDialogAndLine(mockDom(1200, 100), { x: 1900, y: 900 }, { yOffset: 20 });
    await nextTick();

    expect(DialogData.lineDeg).toBeGreaterThan(180); // 360 + (负角) ∈ (180, 270)
    expect(DialogData.lineDeg).toBeLessThan(270);
  });
});

describe("calculateDialogPosition", () => {
  let DialogData;

  beforeEach(() => {
    DialogData = {
      DialogX: 0, DialogY: 0, lineX: 0, lineY: 0, lineLength: 0, lineDeg: 0,
    };
    vi.stubGlobal("innerWidth", 1920);
    vi.stubGlobal("innerHeight", 1080);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getDialogDom 注入：同步计算（无 nextTick），无溢出分支", () => {
    const dom = mockDom(300, 200);
    const dp = createDialogPosition({ DialogData, getDialogDom: () => dom });
    dp.calculateDialogPosition({ x: 500, y: 400 });

    expect(DialogData.DialogX).toBe(500);
    expect(DialogData.DialogY).toBe(400);
    // 源码硬编码 -50/150（与 LINE_ADJUST 一致）
    expect(DialogData.lineY).toBe((400 * 2 - 50) / 2);
    expect(DialogData.lineX).toBe((500 * 2 + 150) / 2);
    expect(DialogData.lineLength).toBe(Math.sqrt(150 * 150 + 50 * 50));
  });

  it("无 getDialogDom 时安全跳过测量（clickPoint 仍写入）", () => {
    const dp = createDialogPosition({ DialogData });
    dp.calculateDialogPosition({ x: 300, y: 300 });

    expect(DialogData.DialogX).toBe(300);
    expect(DialogData.DialogY).toBe(300);
    expect(DialogData.lineLength).toBe(0);
  });

  it("Y/X 溢出分支生效（弹窗不超出视口）", () => {
    const dom = mockDom(300, 400);
    const dp = createDialogPosition({ DialogData, getDialogDom: () => dom });
    // DialogY=900 → restHeight = 1080-900-100 = 80 < 400
    // DialogX=1800 → restWidth = 1920-1800-200 = -80 < 300
    dp.calculateDialogPosition({ x: 1800, y: 900 });

    const moveHeight = 400 - 80;
    expect(DialogData.DialogY).toBe(900 - moveHeight);
    const moveWidth = 300 - -80;
    expect(DialogData.DialogX).toBe(1800 - moveWidth);
  });
});

describe("getDialogYOffset", () => {
  const dp = createDialogPosition({ DialogData: {} });

  it("ConfigParams 未定义（本项目恒 undefined）→ 0", () => {
    expect(dp.getDialogYOffset(undefined)).toBe(0);
    expect(dp.getDialogYOffset(null)).toBe(0);
  });

  it("ShowColunmChart === 3 → DEFAULT_Y", () => {
    expect(dp.getDialogYOffset({ ShowColunmChart: 3 })).toBe(
      CLICK_CONFIG.DIALOG_OFFSET.DEFAULT_Y
    );
  });

  it("LegendStyle === 1 → LEGEND_STYLE_Y", () => {
    expect(dp.getDialogYOffset({ LegendStyle: 1 })).toBe(
      CLICK_CONFIG.DIALOG_OFFSET.LEGEND_STYLE_Y
    );
  });

  it("ShowColunmChart 1/2 → 对应柱图偏移", () => {
    expect(dp.getDialogYOffset({ ShowColunmChart: 1 })).toBe(
      CLICK_CONFIG.DIALOG_OFFSET.COLUMN_CHART_1_Y
    );
    expect(dp.getDialogYOffset({ ShowColunmChart: 2 })).toBe(
      CLICK_CONFIG.DIALOG_OFFSET.COLUMN_CHART_2_Y
    );
    // 其他值 → 默认 0
    expect(dp.getDialogYOffset({ ShowColunmChart: 9 })).toBe(0);
  });
});
