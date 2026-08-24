/**
 * FileName: text.js
 * Author: alexppap
 * Date: 2026-08-21
 * Description: 场地文字绘制层。由源项目 CSS-Web public/js/map/text.js
 *              （310 行）移植（v6 → v8）：
 *              - PIXI.Text → 具名导入 Text（v8 直接可用）
 *              - PIXI.DEG_TO_RAD → 具名导入 DEG_TO_RAD
 *              - event.data.originalEvent.clientX → event.nativeEvent.clientX
 *                （v8 FederatedEvent 字段更名，见移植计划 §5）
 *              - Map.render() → Map.render?.()（常驻渲染下冗余但无害）
 *              - drawFieldText 参数由 11 个位置参数改为 ctx 对象；源码内联
 *                的 ClickedMapItemBorder 局部重赋值（闭包丢失）改为经
 *                dialogState.setClickedMapItemBorder 正确登记；开头四行
 *                （隐藏边框/关弹窗/emit/重置类型）等价于 DialogData.closeDialog()
 * Version: 1.0.0
 */
import { Text, Container, DEG_TO_RAD } from "pixi.js";
import {
  lngLatToMapPixel,
  findPolyVisualCenter,
  createPolygonGraphic,
} from "../utils/mapUtils";

// 文本样式常量
const TEXT_STYLES = {
  LABEL: {
    fontSize: 40,
    fill: 0x000000,
    backgroundColor: "#fff",
  },
  FIELD: {
    fontFamily: "Arial",
    fontSize: 45,
    fill: 0xffffff,
    align: "center",
  },
};

// 交互相关常量
const INTERACTION_CONFIG = {
  LINE_HEIGHT: 40,
  BORDER_COLOR: 0x30ffff,
  BORDER_WIDTH: 2,
  DEFAULT_LONG: 150,
  OFFSET_X: 600,
  OFFSET_Y: 70,
  ITEM_HEIGHT: 25,
  HEADER_HEIGHT: 80,
};

// 布局相关常量
const LAYOUT_CONFIG = {
  MAX_WIDTH: 1920,
  MAX_HEIGHT: 1080,
  DIALOG_WIDTH: 300,
  MAX_ITEMS: 8,
};

/**
 * 销毁文本实例
 * @param {object[]} textInstances 文本实例数组
 */
const destroyTextInstances = (textInstances) => {
  if (textInstances && textInstances.length > 0) {
    textInstances.forEach((item) => {
      if (item.children) {
        item.children.forEach((child) => {
          child.destroy?.();
        });
      }
      item.destroy?.();
    });
    textInstances.length = 0;
  }
};

/**
 * 计算地图坐标到像素坐标的转换
 * 注：centerPoint 来自 findPolyVisualCenter，形如 [x, y]；原实现按
 * lngLatToMercator(centerPoint[1], centerPoint[0]) 调用，等价于
 * lngLatToMapPixel 的 { lng: centerPoint[0], lat: centerPoint[1] }
 * @param {number[]} centerPoint 中心点坐标（源码传参顺序）
 * @param {object} mapInfo 地图信息（Origin）
 * @returns {object} 像素坐标 {x, y}
 */
const calculatePosition = (centerPoint, mapInfo) => {
  const [x, y] = lngLatToMapPixel({
    lng: centerPoint[0],
    lat: centerPoint[1],
    mapInfo,
  });
  return { x, y };
};

/**
 * 创建多行文本容器
 * @param {string[]} texts 文本内容数组
 * @param {number} angle 旋转角度（度）
 * @returns {object} PIXI.Container 文本容器
 */
const createTextContainer = (texts, angle) => {
  const container = new Container();
  let maxWidth = 0;

  texts.forEach((text, index) => {
    const textObj = new Text(text, TEXT_STYLES.FIELD);
    textObj.x = 0;
    textObj.y = -(index * INTERACTION_CONFIG.LINE_HEIGHT);
    container.addChild(textObj);
    maxWidth = Math.max(textObj.width, maxWidth);
  });

  // 居中每行文本
  container.children.forEach((text) => {
    text.x = -text.width / 2;
  });

  container.rotation = DEG_TO_RAD * angle;
  return container;
};

/**
 * 计算对话框位置和连接线信息
 * v8 差异：event.data.originalEvent → event.nativeEvent
 * @param {object} event v8 FederatedPointerEvent
 * @param {object} DialogData 对话框数据（就地更新）
 * @returns {object} 更新后的对话框数据
 */
const calculateDialogPosition = (event, DialogData) => {
  const clientX = event.nativeEvent?.clientX ?? 0;
  const clientY = event.nativeEvent?.clientY ?? 0;
  DialogData.DialogX = clientX / DialogData.zoomX;
  DialogData.DialogY = clientY / DialogData.zoomY;

  let long = INTERACTION_CONFIG.DEFAULT_LONG;
  if (
    DialogData.DialogX >
    LAYOUT_CONFIG.MAX_WIDTH -
      INTERACTION_CONFIG.DEFAULT_LONG -
      LAYOUT_CONFIG.DIALOG_WIDTH
  ) {
    long = -INTERACTION_CONFIG.DEFAULT_LONG;
  }

  const point1 = { x: DialogData.DialogX, y: DialogData.DialogY };
  const point2 = {
    x: DialogData.DialogX + long,
    y: DialogData.DialogY - INTERACTION_CONFIG.OFFSET_Y,
  };

  const deltaX = point2.x - point1.x;
  const deltaY = point2.y - point1.y;
  const angle = (360 * Math.atan2(deltaY, deltaX)) / (2 * Math.PI);

  DialogData.lineX = (point1.x + point2.x) / 2;
  DialogData.lineY = (point1.y + point2.y) / 2;
  DialogData.lineLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  DialogData.lineDeg = angle <= -90 ? 360 + angle : angle;

  if (
    DialogData.DialogX >
    LAYOUT_CONFIG.MAX_WIDTH -
      INTERACTION_CONFIG.DEFAULT_LONG -
      LAYOUT_CONFIG.DIALOG_WIDTH
  ) {
    DialogData.DialogX -= INTERACTION_CONFIG.OFFSET_X;
  }

  return DialogData;
};

/**
 * 调整对话框垂直位置（视口下溢出时上移）
 * @param {object} DialogData 对话框数据
 */
const adjustDialogVerticalPosition = (DialogData) => {
  // 原实现 `items[0]?.DialogData.length || Object.keys(items[0]?.DialogData).length`
  // 两个分支都会在 DialogData 缺失时抛错（?. 断链后仍访问 .length /
  // Object.keys(undefined)）。此处显式取值并兜底 0。
  const dialogPayload = DialogData.ClickedMapItems?.[0]?.DialogData;
  let dataArrLength = 0;
  if (Array.isArray(dialogPayload)) {
    dataArrLength = dialogPayload.length;
  } else if (dialogPayload && typeof dialogPayload === "object") {
    dataArrLength = Object.keys(dialogPayload).length;
  }

  if (DialogData.DialogY > LAYOUT_CONFIG.MAX_HEIGHT - LAYOUT_CONFIG.DIALOG_WIDTH) {
    DialogData.DialogY -=
      (dataArrLength > LAYOUT_CONFIG.MAX_ITEMS
        ? LAYOUT_CONFIG.MAX_ITEMS
        : dataArrLength) *
        INTERACTION_CONFIG.ITEM_HEIGHT +
      INTERACTION_CONFIG.HEADER_HEIGHT;
  }
};

/**
 * 绘制场地标签文字（对应 watch FieldTextInfos）
 * @param {object} params 参数对象
 * @param {object} params.props 组件属性（FieldTextInfos）
 * @param {object} params.mapInfo 地图信息（Origin）
 * @param {object} params.mapContainer 地图容器
 * @param {object} params.Map PixiMap 实例（render 触发渲染）
 * @param {object} params.textState 文本状态（FieldTexts）
 */
export function drawFieldTexts({ props, mapInfo, mapContainer, Map, textState }) {
  // 销毁现有文本实例
  destroyTextInstances(textState.FieldTexts);

  // 渲染场地标签
  props.FieldTextInfos.LayerLabelOverlayInfos?.forEach((item) => {
    const TextObj = new Text(item.Label, TEXT_STYLES.LABEL);

    // 计算文本位置（Origin 缺失按 0，避免 NaN 坐标导致文字静默不渲染）
    const [labelX, labelY] = lngLatToMapPixel({
      lng: Number(item.MapLocation.CenterX),
      lat: Number(item.MapLocation.CenterY),
      mapInfo,
    });

    // 设置文本属性
    TextObj.anchor.set(0.5, 0.5);
    TextObj.x = labelX;
    TextObj.y = labelY;
    TextObj.angle = item.MapLocation.Angle;

    textState.FieldTexts.push(TextObj);
    mapContainer.addChild(TextObj);
  });

  Map.render?.();
}

/**
 * 绘制场地文字（可点击模式下附带场地点击弹窗逻辑）
 * @param {object} ctx 上下文参数
 * @param {object[]} ctx.arr 场地数据数组（含 text/MapPoints/Angle/FieldID）
 * @param {object} ctx.mapInfo 地图信息（Origin）
 * @param {object} ctx.mapContainer 地图容器
 * @param {object} ctx.props 组件属性（fieldClickable/FieldInfos）
 * @param {object[]} ctx.MapLayer 底图元素池（按 FieldID 匹配目标图形）
 * @param {object} ctx.dialogState 弹窗状态（DialogData/clickEventType/setClickedMapItemBorder）
 * @param {object} ctx.Map PixiMap 实例（render 触发渲染）
 * @param {Function} [ctx.MapLayerPush] 高亮边框入池函数
 * @param {object} ctx.textState 文本状态（FieldTextsPIXI）
 */
export function drawFieldText({
  arr,
  mapInfo,
  mapContainer,
  props,
  MapLayer,
  dialogState,
  Map,
  MapLayerPush,
  textState,
}) {
  const DialogData = dialogState.DialogData;

  // 销毁现有文本实例
  destroyTextInstances(textState.FieldTextsPIXI);

  arr.forEach((item) => {
    // 绘制场地文字
    if (item.text && item.text.length > 0) {
      // 寻找多边形可视中心点
      const centerPoint = findPolyVisualCenter(item.MapPoints);
      const position = calculatePosition(centerPoint, mapInfo);

      // 创建文本容器
      const textContainer = createTextContainer(item.text, item.Angle);
      textContainer.position.set(position.x, position.y);

      // 添加到地图容器
      textState.FieldTextsPIXI.push(textContainer);
      mapContainer.addChild(textContainer);

      // 处理点击事件
      if (props.fieldClickable && !props.FieldInfos?.MapAreaTotalInfos?.length) {
        const flag = MapLayer.filter((it) => it.FieldID === item.FieldID);
        const target = flag[flag.length - 1];

        const fieldClick = function (event) {
          // 隐藏边框 + 关闭弹窗 + changeShowTransitRecords 通知 + 重置点击类型
          // （源码四行内联逻辑，等价于 closeDialog）
          DialogData.closeDialog();

          // 创建新的边框对象，使用统一的createPolygonGraphic函数
          const itemBorder = createPolygonGraphic({
            item: null, // 不需要
            polygonVertices: target.polygonVertices,
            mapInfo: null, // 不需要
            borderConfig: {
              width: INTERACTION_CONFIG.BORDER_WIDTH,
              color: INTERACTION_CONFIG.BORDER_COLOR,
            }, // 自定义边框配置
            fillColor: 0, // 0表示透明，因为只是边框
            transparency: 0, // 0表示完全透明
            options: {
              hasFill: false, // 只绘制边框，不填充
              interactive: false, // 不需要交互
              centerCalculation: false, // 不计算中心
              position: {
                x: target.x, // 使用目标图形的位置
                y: target.y, // 使用目标图形的位置
                angle: target.angle, // 使用目标图形的角度
                scaleX: 1,
                scaleY: 1,
              },
            },
          });

          // 登记全局边框对象并添加到地图容器中
          // （源码重赋局部变量导致引用丢失，此处经 dialogState 正确登记）
          dialogState.setClickedMapItemBorder(itemBorder);
          MapLayerPush?.(itemBorder);
          mapContainer.addChild(itemBorder);

          // 显示对话框
          DialogData.showDialog = true;

          // 计算对话框位置和连接线信息
          calculateDialogPosition(event, DialogData);

          // 更新对话框数据
          target.DialogData = item?.DialogData;
          target.clickEventType = "";
          DialogData.ClickedMapItems = [target];

          // 调整对话框垂直位置
          adjustDialogVerticalPosition(DialogData);

          Map.render?.();
        };

        if (target && item) {
          target.on("pointerdown", fieldClick);
        }
      }
    }
  });

  // 统一渲染
  Map.render?.();
}
