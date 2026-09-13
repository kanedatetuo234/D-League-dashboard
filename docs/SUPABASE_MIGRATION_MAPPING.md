# Google Sheets → Supabase列定義

## members

| Sheets列 | Supabase | 内容 |
|---|---|---|
| `player_id` | `members.player_id` | メンバー識別子 |
| `display_name` / `player_name` | `members.display_name` | 表示名 |
| `active` | `members.active` | 有効フラグ |
| `color` | `members.color` | グラフ色 |
| `icon` | `members.icon` | 順位表示アイコン |

## results

| Sheets列 | Supabase | 内容 |
|---|---|---|
| `game_id` | `matches.legacy_game_id` | 旧データとの対応キー |
| `date` | `matches.played_on` | 対局日 |
| `game_type` | `matches.game_type` | `hanchan` / `tonpu` |
| `comment` | `matches.comment` | 対局コメント |
| `yakuman` | `matches.yakuman` | 役満フラグ |
| `player_id` | `match_players.player_id` | 参加者 |
| `rank` | `match_players.rank` | 順位 |
| `score` | `match_players.score` | 持ち点 |
| `seat_order` / `seat` | `match_players.seat` | 東・南・西・北 |
| `yakitori` | `match_players.yakitori` | 焼き鳥フラグ |
| `chips` | `match_players.chips` | 祝儀枚数 |
| `point` | `match_players.point` | 最終ポイント |
| `point_breakdown` / `breakdown` | `match_players.point_breakdown` | 計算内訳JSON |

同じ`game_id`を持つ4行を1つの`matches`と4つの`match_players`へまとめる。同一日の複数対局は`game_id`が異なるため、別対局として保持する。

## schedules

| Sheets列 | Supabase | 内容 |
|---|---|---|
| `date` / `schedule_date` | `schedules.schedule_date` | 対局候補日 |
| `player_id` | `schedules.player_id` | メンバー |
| `status` / `available` | `schedules.status` | 可・未定・不可 |
| `comment` | `schedules.comment` | 予定コメント |
