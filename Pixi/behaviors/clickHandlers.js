/**
 * FileName: clickHandlers.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 点击交互与弹窗行为。由源项目 CSS-Web MapTemplate.vue 移植：
 *              - onHullFieldClick（1860–1905）：船体底图场地点击
 *              - PBSOnClick（1911–2016）：PBS 点击（含 setPosition 定位放大）
 *              - materialOnClick（2086–2134）/ shipSpritesOnClick（2140–2171）/
 *                departmentSpritesOnClick（2173–2206）
 *              - closeDialogsAndCleanup（1206–1234）：交互开始时统一关闭弹窗
 *              - hover 链（825–953）：bindMouseMoveEvent / handleFieldMouseMove /
 *                handleFieldHit / findMatchingField
 *              - resetDialogState（1819–1830）
 *              差异：
 *              - 闭包环境（Map/mapContainer/各 state/emit/refs）改为工厂
 *                ctx 依赖注入：{ pixiMap, states, mapInfo, emit, dialogPosition,
 *                mapApi, coordinateSystem, scale, props, getDialogDom,
 *                clickEventType, modalTitle, shipNoTitle, configParams }
 *              - 详情接口由同步 XHR 回调改 await mapApi.xxx()（全异步）
 *              - document.getElementById("dialog") → getDialogDom 注入
 *              - v8：event.data.global → event.global
 *              - 源码 Map.render() 全部删除：常驻渲染下 ticker 每帧自动出图
 *              - exportMapAsPNG 已由 core/PixiMap.exportAsPNG 提供，不在此实现
 * Version: 1.0.0
 */
import {
  createHighlightBorder,
  clearBorderList,
  clickThroughTest,
} from "../utils/mapUtils";
import { CLICK_CONFIG } from "./dialogPosition";

/**
 * 创建点击处理器集合
 * @param {object} ctx 依赖注入上下文
 * @param {object} ctx.pixiMap PixiMap 实例（提供 mapContainer）
 * @param {object} ctx.states createAllStates 结果（dialogState/spriteState/
 *   mapLayerState 等）
 * @param {object} ctx.mapInfo 地图信息对象（Scale 等，调用方维护）
 * @param {Function} ctx.emit 组件 emit 函数
 * @param {object} ctx.dialogPosition behaviors/dialogPosition 实例
 * @param {object} ctx.mapApi api/mapApi 实例
 * @param {object} [ctx.coordinateSystem] core/CoordinateSystem 实例
 *   （PBSOnClick setPosition 分支的 resetMap/calculateScaleTransform/
 *   adjustElementsOnScale）
 * @param {object} ctx.scale 当前缩放 ref（setPosition 分支写 2）
 * @param {object} ctx.props 组件 props（isHull/feildTextVisible/isSynced/
 *   NowTabID/mapObj/FieldInfos）
 * @param {Function} [ctx.getDialogDom] 弹窗 DOM 获取 () => HTMLElement|null
 * @param {object} ctx.clickEventType 当前点击类型 ref
 * @param {object} ctx.modalTitle 弹窗标题 ref
 * @param {object} [ctx.shipNoTitle] 船号标题 ref（ShipSprites/Department 用）
 * @param {object} [ctx.configParams] 路由级配置（本项目恒 undefined）
 * @param {Function} [ctx.isUnmounted] 组件卸载守卫 () => boolean（异步回调
 *   返回后不再绘制）
 * @returns {object} { onHullFieldClick, PBSOnClick, materialOnClick,
 *   shipSpritesOnClick, departmentSpritesOnClick, closeDialogsAndCleanup,
 *   resetDialogState, bindMouseMoveEvent, handleFieldMouseMove, destroy }
 */
export function createClickHandlers(ctx) {
  const {
    pixiMap,
    states,
    mapInfo,
    emit,
    dialogPosition,
    mapApi,
    coordinateSystem,
    scale,
    props,
    getDialogDom,
    clickEventType,
    modalTitle,
    shipNoTitle,
    configParams,
    isUnmounted,
  } = ctx;

  const { DialogData } = states.dialogState;
  const { spriteState, mapLayerState } = states;
  const mapContainer = () => pixiMap?.mapContainer;
  const checkUnmounted = () => isUnmounted?.() ?? false;

  /** 高亮边框列表（closeDialogsAndCleanup / destroy 统一销毁） */
  let itemBorderLst = [];

  /** 当前点击高亮边框引用（注册进 dialogState，closeDialog 隐藏） */
  let clickedMapItemBorder = null;

  /**
   * 重置弹窗和交互状态（源 1819–1830，唯一生效版本）
   */
  const resetDialogState = () => {
    // 安全设置边框可见性，避免 null 引用错误
    if (
      clickedMapItemBorder &&
      typeof clickedMapItemBorder.visible !== "undefined"
    ) {
      clickedMapItemBorder.visible = false;
    }
    DialogData.showDialog = false;
    emit("changeShowTransitRecords");
    DialogData.ClickedMapItems = [];
  };

  /**
   * 注册当前点击边框（写入本地引用 + dialogState，closeDialog 时隐藏）
   * @param {object} border 高亮边框
   */
  const registerClickedBorder = (border) => {
    clickedMapItemBorder = border;
    states.dialogState.setClickedMapItemBorder(border);
  };

  /**
   * 计算弹窗定位所需的公共参数（xAdjust + yOffset，五类点击共用）
   * @returns {object} { xAdjust, yOffset }
   */
  const getDialogAdjust = () => ({
    xAdjust:
      configParams?.ShowColunmChart === 1
        ? CLICK_CONFIG.DIALOG_OFFSET.X_ADJUST
        : 0,
    yOffset: dialogPosition.getDialogYOffset(configParams),
  });

  /**
   * 船体底图点击事件处理（源 1860–1905）
   * @param {object} event v8 FederatedPointerEvent
   */
  const onHullFieldClick = (event) => {
    setTimeout(() => {
      if (checkUnmounted()) return;
      const container = mapContainer();
      if (!container) return;

      event.stopPropagation();
      const target = event.target;
      const mousePosition = event.global; // v8：event.data.global → event.global

      // 控制文本显示
      if (!props.feildTextVisible && mapLayerState.fieldTextLst) {
        mapLayerState.fieldTextLst.forEach((item) => {
          item.visible = item.text === target.name;
        });
      }

      // 清除现有边框并创建新边框
      clearBorderList(itemBorderLst);
      const highlightList =
        mapLayerState.MapLayer?.filter((item) => item.name === target.name) ||
        [];
      highlightList.forEach((graphic) => {
        const itemBorder = createHighlightBorder(
          graphic,
          graphic.MyPolygonVertices,
          CLICK_CONFIG.BORDER_STYLE.NORMAL
        );
        itemBorderLst.push(itemBorder);
        container.addChild(itemBorder);
      });

      // 准备弹窗信息（actualSmall 小图模式加画布宽与双偏移）
      const mapID = props.NowTabID || "";
      const pbsInfo = {
        PBSName: target.name,
        clientX:
          mapID.indexOf("actualSmall") !== -1
            ? mousePosition.x + props.mapObj.MapWidth + 15 + 40
            : mousePosition.x + 15,
        clientY: mousePosition.y,
      };

      // 显示弹窗并同步状态
      emit("showModal", pbsInfo);
      if (props.isSynced) {
        emit("changeClick", target.name);
      }
    }, 100);
  };

  /**
   * PBS 点击事件处理（源 1911–2016，详情接口改异步）
   * @param {object} PBSID 含 PBSID 的对象（源签名如此）
   * @param {boolean} [setPosition] 是否定位放大到该 PBS
   */
  const PBSOnClick = async (PBSID, setPosition) => {
    const container = mapContainer();
    const PBS = spriteState.PBSs.find((it) => it.PBSID === PBSID.PBSID);
    if (!PBS || !container) return;

    // 定位放大：重置视角 → 以 PBS 为中心缩放至 2 倍
    if (setPosition && coordinateSystem) {
      coordinateSystem.resetMap();
      const pbsGlobalPos = PBS.getGlobalPosition();
      const scaleTransform = coordinateSystem.calculateScaleTransform(
        pbsGlobalPos
      );
      scale.value = 2;
      container.scale.set(scale.value);
      const newPosition = scaleTransform.getNewPosition(scale.value);
      container.position.set(newPosition.x, newPosition.y);
      coordinateSystem.adjustElementsOnScale(scale.value);
    }

    resetDialogState();
    clickEventType.value = "PBS";
    modalTitle.value = PBS.PBSCode;

    // 清除现有边框并创建高亮边框（带角度/镜像/Scale 变换）
    clearBorderList(itemBorderLst);
    const border = createHighlightBorder(
      PBS,
      PBS.MyPolygonVertices,
      CLICK_CONFIG.BORDER_STYLE.HIGHLIGHT
    );
    border.angle = PBS.MyAngle;
    border.scale.x = mapInfo.Scale
      ? PBS.MyMirror
        ? -mapInfo.Scale
        : mapInfo.Scale
      : 1;
    border.scale.y = mapInfo.Scale || 1;
    itemBorderLst.push(border);
    registerClickedBorder(border);
    container.addChild(border);

    // 查询 PBS 详细信息（源回调式改 await）
    try {
      const res = await mapApi.queryPBSDetailInfo({ PBSIDs: [PBS.PBSID] });
      if (checkUnmounted()) return;
      if (res?.status === 1) {
        DialogData.showDialog = true;
        DialogData.ClickedMapItems = res.data.map((it) => ({
          ...it,
          clickEventType: "PBS",
        }));

        // 计算弹窗位置（调用方 nextTick 后经 getDialogDom 传入 DOM）
        const globalPoint = PBS.getGlobalPosition();
        dialogPosition.adjustDialogAndLine(
          getDialogDom?.() || null,
          globalPoint,
          getDialogAdjust()
        );
      }
    } catch (error) {
      console.error("查询 PBS 详情失败:", error);
    }
  };

  /**
   * 物资点击事件处理（源 2086–2134）
   * @param {object} pixiItem 物资 PIXI 对象
   * @param {boolean} [isSprite] 是否为精灵对象（精灵不绘制边框）
   */
  const materialOnClick = async (pixiItem, isSprite = false) => {
    const container = mapContainer();
    if (!container) return;

    resetDialogState();
    clickEventType.value = "Material";
    modalTitle.value = pixiItem.Name;

    // 非精灵元素创建边框（源未 push 入 itemBorderLst，此处补上避免泄漏）
    if (!isSprite) {
      const border = createHighlightBorder(
        pixiItem,
        pixiItem.MyPolygonVertices,
        CLICK_CONFIG.BORDER_STYLE.HIGHLIGHT
      );
      border.angle = pixiItem.MyAngle;
      border.scale.x = mapInfo.Scale
        ? pixiItem.MyMirror
          ? -mapInfo.Scale
          : mapInfo.Scale
        : 1;
      border.scale.y = mapInfo.Scale || 1;
      itemBorderLst.push(border);
      registerClickedBorder(border);
      container.addChild(border);
    }

    // 查询物资详细信息
    try {
      const res = await mapApi.queryMaterialDetailInfo({
        MaterialIDs: [pixiItem.RefObjectID],
      });
      if (checkUnmounted()) return;
      if (res?.status === 1) {
        DialogData.ClickedMapItems = res.data.map((it) => ({
          ...it,
          clickEventType: "Material",
        }));
        DialogData.showDialog = true;

        // 计算弹窗位置
        const globalPoint = pixiItem.getGlobalPosition();
        dialogPosition.adjustDialogAndLine(
          getDialogDom?.() || null,
          globalPoint,
          getDialogAdjust()
        );
      }
    } catch (error) {
      console.error("查询物资详情失败:", error);
    }
  };

  /**
   * 船图点击事件处理（源 2140–2171）
   * @param {object} element 船舶精灵元素（含 projectInfoID）
   */
  const shipSpritesOnClick = async (element) => {
    resetDialogState();
    clickEventType.value = "ShipSprites";

    // 查询船舶详细信息
    try {
      const res = await mapApi.queryShipDetail({
        ProjectInfoID: element.projectInfoID,
      });
      if (checkUnmounted()) return;
      if (res?.status === 1) {
        shipNoTitle.value = res.data?.ShipNo || "";
        modalTitle.value = res.data?.ShipName || "";

        DialogData.ClickedMapItems = [
          {
            ...res.data,
            clickEventType: "ShipSprites",
          },
        ];
        DialogData.showDialog = true;

        // 计算弹窗位置
        const globalPoint = element.getGlobalPosition();
        dialogPosition.adjustDialogAndLine(
          getDialogDom?.() || null,
          globalPoint,
          getDialogAdjust()
        );
      }
    } catch (error) {
      console.error("查询船舶详情失败:", error);
    }
  };

  /**
   * 部门定位点击事件处理（源 2173–2206）
   * @param {object} element 部门精灵元素
   * @param {object} item 部门数据（含 DepartmentID）
   */
  const departmentSpritesOnClick = async (element, item) => {
    resetDialogState();
    clickEventType.value = "DepartmentSprites";

    // 查询部门出勤与隐患
    try {
      const res = await mapApi.queryDepartmentAttendanceAndHiddenRisk({
        depID: item.DepartmentID,
      });
      if (checkUnmounted()) return;
      if (res?.status === 1) {
        shipNoTitle.value = res.data?.AttendanceCount || "";
        modalTitle.value = res.data?.AttendanceCount || "";
        DialogData.ClickedMapItems = [
          {
            ...res.data,
            clickEventType: "DepartmentSprites",
          },
        ];
        DialogData.showDialog = true;

        // 计算弹窗位置
        const globalPoint = element.getGlobalPosition();
        dialogPosition.adjustDialogAndLine(
          getDialogDom?.() || null,
          globalPoint,
          getDialogAdjust()
        );
      }
    } catch (error) {
      console.error("查询部门出勤与隐患失败:", error);
    }
  };

  /**
   * 统一关闭弹窗和清理状态（源 1206–1234，交互开始/滚轮缩放时触发）
   */
  const closeDialogsAndCleanup = () => {
    if (DialogData.showDialog) {
      if (clickedMapItemBorder) clickedMapItemBorder.visible = false;
      DialogData.ClickedMapItems = [];
      DialogData.showDialog = false;
      emit("changeShowTransitRecords");
      clickEventType.value = "";
    }
    if (props.isHull) {
      emit("showModal", "");

      // 清除边框
      if (itemBorderLst.length) {
        itemBorderLst.forEach((border) => border.destroy?.());
        itemBorderLst = [];
      }

      // 控制文本显示
      if (!props.feildTextVisible && mapLayerState.fieldTextLst) {
        mapLayerState.fieldTextLst.forEach((item) => {
          item.visible = false;
        });
      }

      if (props.isSynced) {
        emit("changeClick", "");
      }
    }
  };

  // ------------------------------
  // 场地 hover 链（源 825–953）
  // ------------------------------
  /** hover 命中检测的待处理事件与 rAF 句柄（节流用） */
  let pendingHoverEvent = null;
  let hoverRafId = null;

  /**
   * 绑定鼠标移动事件（mousemove 链入口）
   *
   * 以 rAF 合并：handleFieldMouseMove 内部会对 MapLayer 全量做
   * containsPoint 命中检测，底图上千个多边形时单次开销可观，而 mousemove
   * 每秒可触发上百次。合并后每帧最多检测一次，只保留最新坐标。
   * 注：节流只在此处，handleFieldMouseMove 本身保持同步（供直接调用/测试）。
   * @param {object} container 容器对象（PIXI.Container）
   */
  const bindMouseMoveEvent = (container) => {
    container.on("mousemove", (event) => {
      // 事件对象在 v8 中会被复用，仅取所需坐标快照
      pendingHoverEvent = { global: { x: event.global.x, y: event.global.y } };
      if (hoverRafId !== null) return;

      hoverRafId = requestAnimationFrame(() => {
        hoverRafId = null;
        const queued = pendingHoverEvent;
        pendingHoverEvent = null;
        if (queued) handleFieldMouseMove(queued);
      });
    });
  };

  /**
   * 处理场地鼠标移动逻辑（hover 命中 → 显示/隐藏场地弹窗）
   * @param {object} event v8 FederatedPointerEvent
   */
  const handleFieldMouseMove = (event) => {
    // 非场地点击类型或无数据时直接返回
    if (
      !props.FieldInfos?.MapAreaTotalInfos?.length ||
      !["", "Field"].includes(clickEventType.value)
    ) {
      return;
    }

    const clickPoint = event.global; // v8：event.data.global → event.global
    const hitElements = clickThroughTest(mapLayerState.MapLayer, clickPoint);

    // 过滤船舶相关元素
    if (hitElements.some((it) => it.ShipNo === undefined)) {
      handleFieldHit(hitElements, clickPoint);
    } else if (!DialogData.ClickedMapItems[0]?.PBSCode) {
      resetDialogState();
    }
  };

  /**
   * 处理场地命中逻辑
   * @param {object[]} hitElements 命中元素列表
   * @param {object} clickPoint 点击坐标
   */
  const handleFieldHit = (hitElements, clickPoint) => {
    const { field, ele } = findMatchingField(hitElements);

    if (field && !DialogData.ClickedMapItems[0]?.ShipNo) {
      // 设置弹窗状态
      clickEventType.value = "Field";
      modalTitle.value = "场地";
      ele.clickEventType = "Field";

      DialogData.ClickedMapItems = [ele];
      DialogData.showDialog = true;
      dialogPosition.calculateDialogPosition(clickPoint);
    } else if (!field && !DialogData.ClickedMapItems[0]?.ShipNo) {
      resetDialogState();
    }
  };

  /**
   * 查找匹配的场地
   * @param {object[]} hitElements 命中元素列表
   * @returns {object} 匹配结果 { field, ele }
   */
  const findMatchingField = (hitElements) => {
    let result = { field: undefined, ele: undefined };

    props.FieldInfos.MapAreaTotalInfos?.some((info) => {
      const match = hitElements.find((item) => item.FieldID === info.FieldID);
      if (match) {
        result = { field: match, ele: info };
        return true;
      }
      return false;
    });

    return result;
  };

  /**
   * 销毁（清理高亮边框列表与引用，取消挂起的 hover 检测）
   */
  const destroy = () => {
    // 取消挂起的 rAF：否则卸载后回调仍会读 MapLayer / 写 DialogData
    if (hoverRafId !== null) {
      cancelAnimationFrame(hoverRafId);
      hoverRafId = null;
    }
    pendingHoverEvent = null;
    clearBorderList(itemBorderLst);
    clickedMapItemBorder = null;
    states.dialogState.clearClickedMapItemBorder();
  };

  return {
    onHullFieldClick,
    PBSOnClick,
    materialOnClick,
    shipSpritesOnClick,
    departmentSpritesOnClick,
    closeDialogsAndCleanup,
    resetDialogState,
    bindMouseMoveEvent,
    handleFieldMouseMove,
    destroy,
  };
}

export default createClickHandlers;
