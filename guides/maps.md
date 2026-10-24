# 地图

用 `<MapLibre>`（`src/shared/map.tsx`，示例 `MapCheck`）之前先读这份。

- 渲染时要联网（样式、瓦片、字形、unpkg 上的 worker）。1080p 120 帧本机约 1 分 40 秒；缺省 GL 是软件渲染也能画（见 CLAUDE.md"画面手法"的 GL 后端），加 `--gl=angle` 用显卡，出问题把并发调小
- 矢量样式的图层按缩放级别整层出现（建筑 14 级、POI 15 级），推镜头穿过这些级别时亮度会跳一下，要平滑就在图层的 opacity 上按 zoom 插值
- 每帧都动相机时，卫星图、地形纹理在无界面渲染里可能闪。只做 2D 平移缩放就用 remotion-best-practices 技能里 maps 的 fixed map plate；真 3D 地形飞行用 Cesium，要 MapTiler 或 Google 的 key，还没接
- 图源署名必须留在画面上（`attribution` 必填）
- 图源：缺省用 OpenFreeMap 的 Liberty 样式（不要 key、不限量、允许商用、带 3D 建筑；没有 SLA，可能停服），署名"OpenFreeMap © OpenMapTiles Data from OpenStreetMap"。OSM 的署名规范：地图是画面主体时角落署名，简介或片尾再写一遍并附 openstreetmap.org/copyright。MapTiler、Stadia 的免费档不许商用，换图源先查条款。地形可以接 Mapterhorn 或 AWS Terrain Tiles（terrarium 编码，免 key），还没接、没实测
- 发 B 站的中国合规（2026-10-23 整理的资料，不是法律意见）：《地图管理条例》要求公开的地图送审、标审图号，景区图、街区图、地铁线路图这类简单地图除外；"谁公开谁送审"，视频也算。OSM 系图源（OpenFreeMap、MapTiler、Stadia、CARTO 都是）按实际控制画国界，台湾、钓鱼岛等和我国标准地图不一致，也没有审图号，所以：
  - 画面里有国界、中国全图或有争议地区时，不用 OSM 系图源。用天地图（自然资源部的 WMTS 栅格瓦片，能当 MapLibre 的 raster 源；在 lbs.tianditu.gov.cn 注册开发者申请 key，写进 `.env`），不改边界、不删注记，画面上标来源和审图号（2026-10 是 GS（2026）4921号，用的时候去官网核对）；只要一张静态底图就从标准地图服务（bzdt.ch.mnr.gov.cn）下载，标它的审图号；或者避开这个机位。天地图还没接、没实测，没有 3D 建筑
  - 只拍城市街区、不带国界的画面可以用 OSM 系图源（算不算街区图例外是推断）。国内 OSM 数据薄，建筑多半没有高度
  - 在有审图号的地图上叠路线、调色、倾斜算不算"直接使用"，没查到官方说法。拿不准就问省级自然资源主管部门，或者送审（免费，约 20 个工作日）
  - 从高德、腾讯、百度取的坐标是 GCJ-02 / BD-09，放到 OSM 或天地图上要先转回 WGS-84，不然偏几百米
- 开工提问选了地图、内容又涉及中国时，把上面的取舍列成选项问用户
