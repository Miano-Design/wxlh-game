# V3 规范审计与落地报告

**目的**: 对照《无限轮回》V3.0 产品级补充需求与开发规范，逐条核对当前仓库实现，补齐缺失项（占位）并记录后续替换计划。

**生成时间**: 2026-09-08

**关键文件**: [data/rules.json](data/rules.json)、[data/v3_spec_inventory.json](data/v3_spec_inventory.json)、[reports/missing_data.json](reports/missing_data.json)

## 一、总体结论

- 已完成：数据抽取脚本、规则模板、装备占位（250）、技能预填（15）、事件/Boss 占位与校验脚本。详见下方映射。
- 部分完成：`js/v5data.js` 已注入 `_auto` 区块包含预填数据，但多数条目为占位/模板，需策划逐条提供最终内容。
- 未完成：技能每级数值、事件分支、Boss 三阶段技能脚本、商城商品逐条目录与掉率、部分装备真实数值。

## 二、按 V3 节点逐项映射（高优先级项）

- 玩家等级、经验表: 已在 [js/v5data.js](js/v5data.js) 中包含 `expTable`，规则写入 [data/rules.json](data/rules.json)。
- 角色数据: 60 条角色存在于 `js/v5data.js`，但多数缺少 `skills` 定义（见 [reports/validation_report.json](reports/validation_report.json)）。占位名与技能需替换。示例位置：[v5_full.merged.auto.refinedmerged.json](v5_full.merged.auto.refinedmerged.json)
- 装备系统: 已生成 259 条（含 250 占位），精填文件：[data/equip_template.generated.refined.json](data/equip_template.generated.refined.json)。真实 `base_stats` 多数缺失。
- 技能系统: 模板在 [data/skills_template.json](data/skills_template.json)，预填样例在 [data/skills_prefill.json](data/skills_prefill.json)。需补全每技能 Lv1..Lv10 数值。
- 事件系统: 已生成 `data/events_template.json` 与 `data/events_placeholders.json`（30 条占位建议）。抽取结果见 [reports/events_extracted.json](reports/events_extracted.json)。
- Boss 与世界: 已从文档抽取世界区块并生成 [reports/worlds_extracted.json](reports/worlds_extracted.json)，为 14 个世界生成 Boss 占位：[data/boss_placeholders.json](data/boss_placeholders.json)。需你或策划逐条标注阶段技能。审阅流程见 [reports/bosses_review.md](reports/bosses_review.md)。
- 招募系统: 初始配置在 [js/config.js](js/config.js)，但建议把概率/保底体系显式写入配置文件并验证。抽卡日志与保底计数已在 `GameCore` 支持。建议导出 `data/recruit_pools.json`（待办）。
- 随机 Seed 与副本生成: `scripts/extract_v5_tables.js` 已解析世界文本；建议在 `js/dungeon.js` 固化 Seed 保存/恢复逻辑（待实现）。

## 三、已创建的占位与自动化脚本

- 装备占位生成: `scripts/generate_equip_placeholders.js` → `data/equip_template.generated.json`（250 条）
- 装备精填: `scripts/refine_equip_prefill.js` → `data/equip_template.generated.refined.json`
- 技能预填: `scripts/prefill_skills_from_reports.js` → `data/skills_prefill.json`
- 事件占位文件: `data/events_placeholders.json`（30 条占位）
- Boss 占位: `data/boss_placeholders.json`（14 个 Boss，每个 3 阶段占位）
- 合并脚本: `scripts/merge_extracted_into_v5.js`, `scripts/apply_prefills.js`, `scripts/merge_refined_equips.js`
- Boss 注释流程: `reports/bosses_review.md` + `scripts/apply_boss_annotations.js`
- V3 校验: `scripts/validate_v3_compliance.js` → `reports/validation_report.json`

## 四、优先级建议与下一步计划（我可以直接执行）

1. 高优先级（现在执行）
  - 把 `data/skills_prefill.json` 扩展为覆盖所有角色的技能占位并注入（自动）。
  - 把事件占位扩充到 30 条并注入 `v5`（用于玩法验证）。
  - 请你/策划开始标注 `reports/bosses_extracted_clean.json`（使用 `reports/bosses_review.md` 指南），我将应用注释并合并。 

2. 中期（需策划数据）
  - 补全每技能 Lv1..Lv10 的数值与成长描述（由策划提供或由数值脚本生成草案供校验）。
  - 提供完整装备库（200–300 条）替换占位。
  - 明确商城商品列表与价格/条件并生成 `data/shop_catalog.json`。

3. 长期（后续迭代）
  - 战斗重构：技能状态/冷却/速度/拓展 AI（归入 `battle.js`）。
  - 副本随机种子保存与恢复（`dungeon.js`）。
  - UI 移动端适配与性能优化（我可按你确认开始改动）。

## 五、文件位置快速访问

- 规则文件: [data/rules.json](data/rules.json)
- V3 映射: [data/v3_spec_inventory.json](data/v3_spec_inventory.json)
- 缺失项: [reports/missing_data.json](reports/missing_data.json)
- 装备占位（原始 / 精填）: [data/equip_template.generated.json](data/equip_template.generated.json), [data/equip_template.generated.refined.json](data/equip_template.generated.refined.json)
- 技能模板与预填: [data/skills_template.json](data/skills_template.json), [data/skills_prefill.json](data/skills_prefill.json)
- 事件占位: [data/events_placeholders.json](data/events_placeholders.json)
- Boss 占位与审阅: [data/boss_placeholders.json](data/boss_placeholders.json), [reports/bosses_review.md](reports/bosses_review.md)
- 校验报告: [reports/validation_report.json](reports/validation_report.json)

---

请指示：我现在是否把 `data/skills_prefill.json` 扩展为覆盖所有角色的技能占位（并注入 v5），以及是否立即把 30 个事件占位注入并刷新 `js/v5data.js`？或者你先想要人工逐条提供数据再合并？
