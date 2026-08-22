/**
 * FileName: state.test.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 阶段 2.4/2.5 —— 绘制状态工厂测试。验收点：实例间字段隔离、
 *              destroy() 销毁链（逐项 destroy({children:true}) 后清空）、
 *              dialogState.closeDialog 回调注入语义。
 * Version: 1.0.0
 */
import { describe, it, expect, vi } from "vitest";
import {
  createAllStates,
  createDialogState,
  createSpriteState,
  createCameraLstState,
  createTextState,
  createBlockCombState,
  createMapLayerState,
} from "@/components/Pixi/state";

/** 构造带 destroy spy 的 mock 显示对象 */
function mockDisplayObject() {
  return { destroy: vi.fn() };
}

describe("实例隔离", () => {
  it("两个 spriteState 的池互不影响", () => {
    const a = createSpriteState();
    const b = createSpriteState();
    a.PBSs.push(mockDisplayObject());
    b.carSprites.push(mockDisplayObject());

    expect(a.PBSs.length).toBe(1);
    expect(b.PBSs.length).toBe(0);
    expect(b.carSprites.length).toBe(1);
    expect(a.carSprites.length).toBe(0);
  });

  it("dialogState 的 DialogData 相互独立", () => {
    const a = createDialogState();
    const b = createDialogState();
    a.DialogData.DialogX = 100;

    expect(a.DialogData.DialogX).toBe(100);
    expect(b.DialogData.DialogX).toBe(0);
  });
});

describe("destroy 销毁链", () => {
  it("spriteState.destroy 逐项销毁并清空", () => {
    const state = createSpriteState();
    const obj1 = mockDisplayObject();
    const obj2 = mockDisplayObject();
    state.PBSs.push(obj1);
    state.materials.push(obj2);

    state.destroy();

    expect(obj1.destroy).toHaveBeenCalledWith({ children: true });
    expect(obj2.destroy).toHaveBeenCalledWith({ children: true });
    expect(state.PBSs.length).toBe(0);
    expect(state.materials.length).toBe(0);
    expect(state.imgLst.length).toBe(0);
  });

  it("blockCombState/mapLayerState/textState.destroy 清空全部池", () => {
    const blockComb = createBlockCombState();
    blockComb.BlockLayer.push(mockDisplayObject());
    blockComb.combTextLst.push(mockDisplayObject());

    const mapLayer = createMapLayerState();
    mapLayer.MapLayer.push(mockDisplayObject());
    mapLayer.fieldTextLst.push(mockDisplayObject());

    const text = createTextState();
    text.FieldTexts.push(mockDisplayObject());
    text.FieldTextsPIXI.push(mockDisplayObject());

    blockComb.destroy();
    mapLayer.destroy();
    text.destroy();

    expect(blockComb.BlockLayer.length).toBe(0);
    expect(blockComb.combTextLst.length).toBe(0);
    expect(mapLayer.MapLayer.length).toBe(0);
    expect(mapLayer.fieldTextLst.length).toBe(0);
    expect(text.FieldTexts.length).toBe(0);
    expect(text.FieldTextsPIXI.length).toBe(0);
  });

  it("cameraState.destroy 触发 disposeCamera 并清空列表", () => {
    const state = createCameraLstState();
    const pixiObj = mockDisplayObject();
    const cameraWithIp = { IPAddress: "rtsp://x", CameraName: "c1" };
    const cameraNoIp = { CameraName: "c2" };
    state.CameraLstPIXI.push(pixiObj);
    state.showCameraLst.push(cameraWithIp, cameraNoIp);

    const disposeCamera = vi.fn();
    state.destroy({ disposeCamera });

    expect(disposeCamera).toHaveBeenCalledTimes(1);
    expect(disposeCamera).toHaveBeenCalledWith(cameraWithIp);
    expect(pixiObj.destroy).toHaveBeenCalledWith({ children: true });
    expect(state.CameraLstPIXI.length).toBe(0);
    expect(state.showCameraLst.length).toBe(0);
  });

  it("destroy 对空池安全", () => {
    expect(() => {
      createSpriteState().destroy();
      createCameraLstState().destroy();
    }).not.toThrow();
  });
});

describe("dialogState", () => {
  it("closeDialog 隐藏边框、重置类型、清空点击项并触发回调", () => {
    const onChangeShowTransitRecords = vi.fn();
    const onRender = vi.fn();
    const state = createDialogState({
      onChangeShowTransitRecords,
      onRender,
    });

    const border = { visible: true };
    state.setClickedMapItemBorder(border);
    state.clickEventType.value = "PBS";
    state.DialogData.showDialog = true;
    state.DialogData.ClickedMapItems.push({ FieldID: "F1" });

    state.DialogData.closeDialog();

    expect(border.visible).toBe(false);
    expect(state.DialogData.showDialog).toBe(false);
    expect(state.clickEventType.value).toBe("");
    expect(state.DialogData.ClickedMapItems.length).toBe(0);
    expect(onChangeShowTransitRecords).toHaveBeenCalledTimes(1);
    expect(onRender).toHaveBeenCalledTimes(1);
  });

  it("弹窗未显示时 closeDialog 不触发回调", () => {
    const onChangeShowTransitRecords = vi.fn();
    const state = createDialogState({ onChangeShowTransitRecords });

    state.DialogData.closeDialog();
    expect(onChangeShowTransitRecords).not.toHaveBeenCalled();
  });

  it("clearClickedMapItemBorder 只清引用不销毁", () => {
    const state = createDialogState();
    const border = { visible: true, destroy: vi.fn() };
    state.setClickedMapItemBorder(border);

    state.clearClickedMapItemBorder();
    state.DialogData.showDialog = true;
    state.DialogData.closeDialog();

    expect(border.destroy).not.toHaveBeenCalled();
    expect(border.visible).toBe(true); // 引用已清，不再隐藏
  });
});

describe("createAllStates 装配", () => {
  it("返回全部状态实例且 destroy 逐层销毁", () => {
    const emit = vi.fn();
    const states = createAllStates(emit);

    const pixiObj = mockDisplayObject();
    const border = { visible: true };
    states.mapLayerState.MapLayer.push(pixiObj);
    states.dialogState.setClickedMapItemBorder(border);
    states.dialogState.DialogData.showDialog = true;

    states.destroy();

    expect(pixiObj.destroy).toHaveBeenCalledWith({ children: true });
    expect(states.mapLayerState.MapLayer.length).toBe(0);
    expect(states.dialogState.DialogData.showDialog).toBe(false);
  });

  it("closeDialog 经注入 emit 派发 changeShowTransitRecords", () => {
    const emit = vi.fn();
    const states = createAllStates(emit);

    states.dialogState.DialogData.showDialog = true;
    states.dialogState.DialogData.closeDialog();

    expect(emit).toHaveBeenCalledWith("changeShowTransitRecords");
  });

  it("emit 为空时装配可用且不抛错", () => {
    const states = createAllStates();
    states.dialogState.DialogData.showDialog = true;
    expect(() => states.dialogState.DialogData.closeDialog()).not.toThrow();
  });
});
