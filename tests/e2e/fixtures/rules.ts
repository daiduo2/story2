export interface RuleDefinition {
  id: string;
  description: string;
  triggerMethod: string;
  expectedDetailPattern: string;
}

export const RULES: RuleDefinition[] = [
  {
    id: "rule_1",
    description: "禁止访问卷零页面（volume-00）",
    triggerMethod: "visit_volume_00",
    expectedDetailPattern: "卷零",
  },
  {
    id: "rule_3",
    description: "禁止搜索被异常注入的关键词",
    triggerMethod: "search_injected_keyword",
    expectedDetailPattern: "注入",
  },
];

export function getRuleById(id: string): RuleDefinition | undefined {
  return RULES.find((r) => r.id === id);
}
