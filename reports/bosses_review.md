# Boss 报表人工标注说明

请在下列每一项中为 `anchor` 标注：

- `valid`: true/false（该 anchor 对应实际 Boss 定义）
- `type`: "boss" / "mechanic" / "note"
- `phases`: 若为 Boss，填写数组，每项为阶段描述或技能关键词字符串

将标注保存为 `reports/bosses_annotations.json`（格式见示例）。

示例（JSON）:

```
{
  "| Boss | 500～3000 |": { "valid": true, "type":"boss", "phases":["Phase1: 普攻","Phase2: 释放增益"] }
}
```

以下为前 12 项供你标注（索引从 1 开始）：

1. anchor: "| Boss | 500～3000 |"  — rawCount: 6
2. anchor: "* Boss"  — rawCount: 2
3. anchor: "* Boss"  — rawCount: 2
4. anchor: "| Boss |  50～150 |"  — rawCount: 3
5. anchor: "* Boss"  — rawCount: 2
6. anchor: "## Boss"  — rawCount: 0
7. anchor: "Boss至少掉落："  — rawCount: 0
8. anchor: "# 29. Boss额外保底"  — rawCount: 0
9. anchor: "Boss："  — rawCount: 0
10. anchor: "Boss Lv1："  — rawCount: 0
11. anchor: "12关Boss："  — rawCount: 0
12. anchor: "Boss："  — rawCount: 0

填好 `reports/bosses_annotations.json` 后，运行：

```bash
node scripts/apply_boss_annotations.js reports/bosses_annotations.json
```

该脚本会把注释合并到 `v5_full.merged.auto.updated.json._auto.boss_annotations`，并刷新 `js/v5data.js`。
