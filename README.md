# 白一把

白一把是一个模仿“弗一把”（`shnlfriberg/csgofriberg`）的《蔚蓝档案》学生猜测游戏。当前版本提供本地可运行的单人模式试玩，并保留多人联机入口作为后续扩展位置。

## 当前状态

- 单人模式：可玩
- 多人联机：入口保留，暂为空页
- 查看答案：可用，点击后本局判负
- 当前设备统计：使用浏览器 `localStorage` 保存
- 数据来源：SchaleDB 当前公开 JSON
- 部署方式：Vite 静态构建，可用 nginx/Docker 挂到服务器试玩

## 运行

```bash
pnpm install
pnpm sync:data
pnpm dev
```

开发服务默认使用 Vite，例如：

```bash
pnpm dev -- --host 127.0.0.1 --port 5175
```

## 构建

```bash
pnpm build
pnpm preview -- --host 0.0.0.0 --port 4173
```

`dist/` 是可直接静态托管的产物。当前项目没有后端状态，单人模式可以先作为纯静态试玩站部署。

## Docker 试玩部署

```bash
docker build -t b1more .
docker run --rm -p 8080:80 b1more
```

然后访问：

```text
http://服务器IP:8080
```

如果你已经有 nginx，可以只运行 `pnpm build`，再把 `dist/` 目录上传到 nginx 的站点根目录。SPA fallback 需要类似：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## 数据同步

`pnpm sync:data` 会优先从 SchaleDB 当前网页使用的公开 JSON 拉取：

- `https://schaledb.com/data/zh/students.min.json`
- `https://schaledb.com/data/zh/localization.min.json`

如果线上请求失败，脚本会回退读取同级目录中的 `../SchaleDB/data/zh/*.json`。生成结果在 `src/data/students.json`。

当前线上数据结构和 GitHub 归档版不同：

- `students.min.json` 是以学生 ID 为 key 的对象，归档版是数组。
- 技能从数组结构变为对象结构，EX 技能位于 `Skills.Ex.Cost`。
- `IsLimited` 当前是和 `IsReleased` 类似的三段数组，项目会按国服/国际服/日服读取对应招募类型。

这说明同步不需要解析页面 DOM，直接抓 JSON 更稳定；真正需要浏览器爬虫的场景主要是验证页面渲染、寻找新增资源路径，或 SchaleDB 以后改成动态接口/鉴权接口。

## 字段

棋盘字段固定为：

- 姓名：`FamilyName + PersonalName`
- 学院：`School`
- 攻击属性：`BulletType`
- 防御属性：`ArmorType`
- 年龄：`CharacterAge`，只保留纯数字；无法解析的脏值标记为 `N/A`
- 职责：`TacticRole`
- 招募类型：`IsLimited`，按当前题库服务器取对应值
- EX Cost：`Skills.Ex.Cost[0]`

纯数字字段 `年龄` 和 `EX Cost` 使用黄色背景与白色上下箭头；其他字段只显示绿色和红色背景。

## 本地统计

单人模式结束后会在当前浏览器设备记录：

- 总局数、胜负、胜率
- 当前连胜、最佳连胜
- 最佳猜数、平均猜数
- 查看答案次数
- 国服/国际服/日服分题库记录

统计只保存在当前设备的浏览器 `localStorage` 中，不会上传服务器。清空浏览器数据或点击首页统计区的“清空”会重置记录。

## 题库

三个模式对应 SchaleDB `IsReleased`：

- 国服：`IsReleased[2]`
- 国际服：`IsReleased[1]`
- 日服：`IsReleased[0]`

当前同步数据池：国服 212、国际服 256、日服 270。

## 开源协议与素材说明

本项目代码采用 `AGPL-3.0-or-later`，详见 [LICENSE](./LICENSE)。

请注意：

- 本仓库只授权“白一把”项目自身代码和文档。
- 《蔚蓝档案》相关名称、角色、图片、图标等素材版权属于其各自权利方。
- SchaleDB 数据和媒体 URL 来自 `https://schaledb.com`，不属于本项目原创资产。
- 公开部署前建议保留 [NOTICE.md](./NOTICE.md) 中的署名说明，并自行确认第三方数据和素材的使用边界。

## 后续上线方向

短期试玩可以继续保持静态部署。后续如果要接近“弗一把”的完整体验，可以逐步补：

- 后端单人对局状态与历史战绩
- 游客/账号体系
- 排行榜和统计
- 多人房间与 Socket.IO 实时对战
- 数据更新后台或定时同步任务
