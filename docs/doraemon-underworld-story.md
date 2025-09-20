# 哆啦A梦：新·大魔境（演示）脚本

> 源文件：`backend/story_engine/stories/doraemon-underworld/story.yaml` 与 `roles.yaml`

## 故事设定

- **起始场景**：S1_opening（学校后空地）
- **封面插图**：`/assets/characters_img/Elara.jpeg`
- **默认变量**：
  - `time` = Day1-Morning
  - `location` = 学校后空地
- **初始标记**：
  - `met_miya` = false
  - `portal_opened` = false

## 角色与道具

| 角色 ID | 名称 | 性格特质 | 初始道具 |
| --- | --- | --- | --- |
| doraemon | 哆啦A梦 | 冷静 / 器械丰富 / 护短 | 竹蜻蜓、任意门、缩小灯 |
| nobita | 大雄 | 胆小 / 善良 / 时常紧张 | 无 |
| shizuka | 静香 | 温柔 / 细心 / 理性 | 手电筒 |

## 场景流程

### S1_opening — 学校后空地
- 描述：放学后大家在空地集合，天空微阴。
- 进入效果：`timeAdvance` → Day1-Morning
- 选项：
  1. `talk_rumor`：与伙伴讨论探险传闻 → 设置 `met_miya = true`，前往 **S2_miya**
  2. `go_home`：各自回家 → `timeAdvance` 至 Evening，前往 **S3_home**

### S2_miya — 谜之少女
- 描述：神秘少女提到“异世界入口”。
- 选项：
  1. `open_portal`：若哆啦A梦持有“任意门”且未开启入口 → 设置 `portal_opened = true`、位置改为校园边缘，前往 **S4_portal**
  2. `investigate_school`：在校园周围调查 → 前往 **S5_investigation**

### S3_home — 回家路上
- 描述：傍晚的街道安静。
- 选项：
  1. `message_friends`：发消息约明早 → `timeAdvance` 至 Day2-Morning，回到 **S1_opening**

### S4_portal — 可疑的门
- 描述：任意门通向幽暗空间。
- 选项：
  1. `step_in`：小心进入 → 前往 **S6_underworld_gate**
  2. `mark_and_retreat`：先做标记 → 设置变量 `marked_portal = true`，回到 **S1_opening**

### S5_investigation — 校园调查
- 描述：在后门与排水沟附近搜寻痕迹。
- 选项：
  1. `follow_clue`：跟随脚印 → 前往 **S4_portal**
  2. `ask_guard`：打听异常 → 返回 **S1_opening**

### S6_underworld_gate — 异界门廊
- 描述：冰凉空气扑面，远处有微光。
- 选项：
  1. `hold_together`：分工保持队形 → 回到 **S1_opening**（后续发展待扩写）

## 状态字段说明

- `flags` 用于推进剧情的布尔开关（示例：`met_miya`、`portal_opened`）。
- `variables` 记录可更新的故事背景信息（示例：`time`、`location`、`marked_portal`）。
- `choices` 中的 `effects` 描述状态变更或跳转逻辑，`when` 表达式控制可选条件。

> 如需调整剧情，直接修改对应 YAML 后重新启动服务即可加载最新脚本。
