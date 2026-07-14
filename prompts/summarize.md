请把新闻整理成结构化日报数据，最终只输出 JSON，不要输出 Markdown，不要加解释文字。

输出格式必须是：
{
  "articles": [
    {
      "title": "中文标题",
      "original_title": "英文原标题；中文来源可为空",
      "source": "来源名称",
      "url": "原文链接",
      "language": "zh-CN 或 en",
      "category": "international_politics/global_economy/ai_industry/cybersecurity/china_globalization",
      "importance_score": 1-10,
      "relevance_score": 1-10,
      "is_top_news": true 或 false,
      "summary_zh": "2-3 句中文摘要，克制、准确、信息密度高",
      "summary_en": "如果原新闻是英文，写 1-2 sentence English summary；如果原新闻是中文，留空字符串",
      "why_it_matters_zh": "一句中文说明为什么重要",
      "why_it_matters_en": "如果原新闻是英文，写 one short English sentence explaining why it matters；否则留空字符串",
      "tags": ["标签1", "标签2"]
    }
  ]
}

要求：
1. 中文清晰、克制、信息密度高。
2. 原新闻是英文时，必须同时提供中文摘要 summary_zh 和英文摘要 summary_en。
3. 不要编造原文没有的信息；无法确认时写“目前信息有限”。
4. 避开明显付费墙内容；如果只有标题和极短摘要，不要生成夸张结论。
5. 每个类别保留 3-5 条，全文总量 15-25 条，重点新闻最多 5 条。
6. 按重要性排序。
