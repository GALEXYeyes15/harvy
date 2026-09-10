//! Convert Harvy Markdown into Notion block JSON.

use pulldown_cmark::{Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use serde_json::{json, Value};

const RICH_TEXT_LIMIT: usize = 2000;

#[derive(Clone, Default)]
struct Marks {
    bold: bool,
    italic: bool,
    strikethrough: bool,
    code: bool,
    href: Option<String>,
}

#[derive(Clone, Copy)]
enum BlockKind {
    Paragraph,
    Heading(u8),
    Quote,
    Bulleted,
    Numbered,
    Todo(bool),
    Code,
}

struct Converter {
    blocks: Vec<Value>,
    kind: Option<BlockKind>,
    rich: Vec<Value>,
    code: String,
    marks: Marks,
    list_ordered: Vec<bool>,
    in_item: bool,
    quote_depth: u32,
}

impl Converter {
    fn new() -> Self {
        Self {
            blocks: Vec::new(),
            kind: None,
            rich: Vec::new(),
            code: String::new(),
            marks: Marks::default(),
            list_ordered: Vec::new(),
            in_item: false,
            quote_depth: 0,
        }
    }

    fn push_text(&mut self, text: &str) {
        if text.is_empty() {
            return;
        }
        if matches!(self.kind, Some(BlockKind::Code)) {
            self.code.push_str(text);
            return;
        }
        if self.kind.is_none() {
            self.kind = Some(if self.in_item {
                if self.list_ordered.last().copied().unwrap_or(false) {
                    BlockKind::Numbered
                } else {
                    BlockKind::Bulleted
                }
            } else {
                BlockKind::Paragraph
            });
        }
        for chunk in split_rich_text(text) {
            self.rich.push(rich_text_item(&chunk, &self.marks));
        }
    }

    fn flush(&mut self) {
        let Some(kind) = self.kind.take() else {
            self.rich.clear();
            self.code.clear();
            return;
        };
        let block = match kind {
            BlockKind::Code => {
                let body = std::mem::take(&mut self.code);
                let text = if body.trim().is_empty() {
                    vec![]
                } else {
                    split_rich_text(body.trim_end_matches('\n'))
                        .into_iter()
                        .map(|chunk| {
                            rich_text_item(
                                &chunk,
                                &Marks {
                                    code: false,
                                    ..Marks::default()
                                },
                            )
                        })
                        .collect()
                };
                json!({
                    "object": "block",
                    "type": "code",
                    "code": {
                        "rich_text": text,
                        "language": "plain text"
                    }
                })
            }
            other => {
                let rich = std::mem::take(&mut self.rich);
                block_from_kind(other, rich)
            }
        };
        self.blocks.push(block);
        self.code.clear();
        self.rich.clear();
    }

    fn start_block(&mut self, kind: BlockKind) {
        if !self.in_item {
            self.flush();
        }
        self.kind = Some(kind);
    }

    fn finish(mut self) -> Vec<Value> {
        self.flush();
        if self.blocks.is_empty() {
            self.blocks.push(block_from_kind(BlockKind::Paragraph, vec![]));
        }
        self.blocks
    }
}

pub fn markdown_to_notion_blocks(markdown: &str) -> Vec<Value> {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);

    let mut conv = Converter::new();
    let mut pending_task: Option<bool> = None;

    for event in Parser::new_ext(markdown, options) {
        match event {
            Event::Start(Tag::Paragraph) => {
                if conv.in_item || conv.quote_depth > 0 {
                    if conv.kind.is_none() {
                        conv.kind = if conv.in_item {
                            Some(list_item_kind(&conv.list_ordered, pending_task.take()))
                        } else {
                            Some(BlockKind::Quote)
                        };
                    }
                } else {
                    conv.start_block(BlockKind::Paragraph);
                }
            }
            Event::End(TagEnd::Paragraph) => {
                if !conv.in_item && conv.quote_depth == 0 {
                    conv.flush();
                }
            }
            Event::Start(Tag::Heading { level, .. }) => {
                conv.start_block(BlockKind::Heading(heading_level(level)));
            }
            Event::End(TagEnd::Heading(_)) => conv.flush(),
            Event::Start(Tag::BlockQuote(_)) => {
                conv.quote_depth += 1;
                conv.start_block(BlockKind::Quote);
            }
            Event::End(TagEnd::BlockQuote(_)) => {
                conv.flush();
                conv.quote_depth = conv.quote_depth.saturating_sub(1);
            }
            Event::Start(Tag::CodeBlock(_)) => conv.start_block(BlockKind::Code),
            Event::End(TagEnd::CodeBlock) => conv.flush(),
            Event::Start(Tag::List(start)) => {
                conv.flush();
                conv.list_ordered.push(start.is_some());
            }
            Event::End(TagEnd::List(_)) => {
                conv.flush();
                conv.list_ordered.pop();
            }
            Event::Start(Tag::Item) => {
                conv.flush();
                conv.in_item = true;
                conv.kind = Some(list_item_kind(&conv.list_ordered, pending_task.take()));
            }
            Event::End(TagEnd::Item) => {
                conv.flush();
                conv.in_item = false;
                pending_task = None;
            }
            Event::TaskListMarker(checked) => {
                pending_task = Some(checked);
                if conv.in_item {
                    conv.kind = Some(BlockKind::Todo(checked));
                }
            }
            Event::Start(Tag::Emphasis) => conv.marks.italic = true,
            Event::End(TagEnd::Emphasis) => conv.marks.italic = false,
            Event::Start(Tag::Strong) => conv.marks.bold = true,
            Event::End(TagEnd::Strong) => conv.marks.bold = false,
            Event::Start(Tag::Strikethrough) => conv.marks.strikethrough = true,
            Event::End(TagEnd::Strikethrough) => conv.marks.strikethrough = false,
            Event::Start(Tag::Link { dest_url, .. }) => {
                conv.marks.href = Some(dest_url.into_string());
            }
            Event::End(TagEnd::Link) => conv.marks.href = None,
            Event::Start(Tag::Image { .. }) => {}
            Event::End(TagEnd::Image) => {}
            Event::Text(text) => conv.push_text(text.as_ref()),
            Event::Code(text) => {
                let prev = conv.marks.code;
                conv.marks.code = true;
                conv.push_text(text.as_ref());
                conv.marks.code = prev;
            }
            Event::SoftBreak => conv.push_text(" "),
            Event::HardBreak => conv.push_text("\n"),
            Event::Rule => {
                conv.flush();
                conv.blocks.push(json!({
                    "object": "block",
                    "type": "divider",
                    "divider": {}
                }));
            }
            Event::Html(html) | Event::InlineHtml(html) => {
                if is_empty_paragraph_html(html.as_ref()) {
                    conv.flush();
                    conv.blocks
                        .push(block_from_kind(BlockKind::Paragraph, vec![]));
                } else if let Some(text) = html_island_plain_text(html.as_ref()) {
                    conv.push_text(&text);
                    if !conv.in_item && conv.quote_depth == 0 {
                        conv.flush();
                    }
                }
            }
            _ => {}
        }
    }

    conv.finish()
}

fn list_item_kind(ordered: &[bool], task: Option<bool>) -> BlockKind {
    if let Some(checked) = task {
        return BlockKind::Todo(checked);
    }
    if ordered.last().copied().unwrap_or(false) {
        BlockKind::Numbered
    } else {
        BlockKind::Bulleted
    }
}

fn heading_level(level: HeadingLevel) -> u8 {
    match level {
        HeadingLevel::H1 => 1,
        HeadingLevel::H2 => 2,
        _ => 3,
    }
}

fn block_from_kind(kind: BlockKind, rich_text: Vec<Value>) -> Value {
    match kind {
        BlockKind::Paragraph => json!({
            "object": "block",
            "type": "paragraph",
            "paragraph": { "rich_text": rich_text }
        }),
        BlockKind::Heading(1) => json!({
            "object": "block",
            "type": "heading_1",
            "heading_1": { "rich_text": rich_text }
        }),
        BlockKind::Heading(2) => json!({
            "object": "block",
            "type": "heading_2",
            "heading_2": { "rich_text": rich_text }
        }),
        BlockKind::Heading(_) => json!({
            "object": "block",
            "type": "heading_3",
            "heading_3": { "rich_text": rich_text }
        }),
        BlockKind::Quote => json!({
            "object": "block",
            "type": "quote",
            "quote": { "rich_text": rich_text }
        }),
        BlockKind::Bulleted => json!({
            "object": "block",
            "type": "bulleted_list_item",
            "bulleted_list_item": { "rich_text": rich_text }
        }),
        BlockKind::Numbered => json!({
            "object": "block",
            "type": "numbered_list_item",
            "numbered_list_item": { "rich_text": rich_text }
        }),
        BlockKind::Todo(checked) => json!({
            "object": "block",
            "type": "to_do",
            "to_do": { "rich_text": rich_text, "checked": checked }
        }),
        BlockKind::Code => json!({
            "object": "block",
            "type": "code",
            "code": { "rich_text": rich_text, "language": "plain text" }
        }),
    }
}

fn rich_text_item(content: &str, marks: &Marks) -> Value {
    let mut item = json!({
        "type": "text",
        "text": { "content": content },
        "annotations": {
            "bold": marks.bold,
            "italic": marks.italic,
            "strikethrough": marks.strikethrough,
            "underline": false,
            "code": marks.code,
            "color": "default"
        }
    });
    if let Some(url) = notion_href(marks.href.as_deref()) {
        item["text"]["link"] = json!({ "url": url });
    }
    item
}

fn notion_href(raw: Option<&str>) -> Option<String> {
    let url = raw.map(str::trim).filter(|u| !u.is_empty())?;
    if url.chars().any(char::is_whitespace) || url.len() > RICH_TEXT_LIMIT {
        return None;
    }
    let lower = url.to_ascii_lowercase();
    if let Some(rest) = lower.strip_prefix("mailto:") {
        return (!rest.is_empty() && rest.contains('@')).then(|| url.to_string());
    }
    let rest = if let Some(rest) = lower.strip_prefix("https://") {
        rest
    } else if let Some(rest) = lower.strip_prefix("http://") {
        rest
    } else {
        return None;
    };
    let host = rest.split(['/', '?', '#']).next().unwrap_or("");
    if host.is_empty() || !host.chars().any(|ch| ch.is_ascii_alphanumeric()) {
        return None;
    }
    Some(url.to_string())
}

fn split_rich_text(text: &str) -> Vec<String> {
    if text.len() <= RICH_TEXT_LIMIT {
        return vec![text.to_string()];
    }
    let mut out = Vec::new();
    let mut remaining = text;
    while !remaining.is_empty() {
        if remaining.len() <= RICH_TEXT_LIMIT {
            out.push(remaining.to_string());
            break;
        }
        let mut end = RICH_TEXT_LIMIT;
        while end > 0 && !remaining.is_char_boundary(end) {
            end -= 1;
        }
        if end == 0 {
            end = remaining.chars().next().map(|c| c.len_utf8()).unwrap_or(1);
        }
        out.push(remaining[..end].to_string());
        remaining = &remaining[end..];
    }
    out
}

fn is_empty_paragraph_html(html: &str) -> bool {
    let trimmed = html.trim();
    matches!(
        trimmed,
        "<p></p>" | "<p><br></p>" | "<p><br/></p>" | "<p><br /></p>"
    )
}

fn html_island_plain_text(html: &str) -> Option<String> {
    let trimmed = html.trim();
    if trimmed.is_empty() {
        return None;
    }
    let lower = trimmed.to_ascii_lowercase();
    if lower.contains("<figure") || lower.contains("<img") {
        return None;
    }
    let mut text = String::new();
    let mut in_tag = false;
    for ch in trimmed.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => text.push(ch),
            _ => {}
        }
    }
    let decoded = text
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'");
    let collapsed = decoded.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.is_empty() {
        None
    } else {
        Some(collapsed)
    }
}

#[cfg(test)]
mod tests {
    use super::markdown_to_notion_blocks;

    fn block_type(block: &serde_json::Value) -> &str {
        block.get("type").and_then(|v| v.as_str()).unwrap_or("")
    }

    fn plain(block: &serde_json::Value) -> String {
        let ty = block_type(block);
        let arr = block
            .get(ty)
            .and_then(|p| p.get("rich_text"))
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        arr.iter()
            .filter_map(|item| {
                item.get("text")
                    .and_then(|t| t.get("content"))
                    .and_then(|c| c.as_str())
            })
            .collect()
    }

    #[test]
    fn converts_headings_lists_and_marks() {
        let blocks = markdown_to_notion_blocks(
            "# Title\n\nHello **world** and *you*.\n\n- one\n- two\n\n1. first\n",
        );
        assert_eq!(block_type(&blocks[0]), "heading_1");
        assert_eq!(plain(&blocks[0]), "Title");
        assert_eq!(block_type(&blocks[1]), "paragraph");
        assert_eq!(plain(&blocks[1]), "Hello world and you.");
        let world = &blocks[1]["paragraph"]["rich_text"][1];
        assert_eq!(world["annotations"]["bold"], true);
        assert_eq!(block_type(&blocks[2]), "bulleted_list_item");
        assert_eq!(plain(&blocks[2]), "one");
        assert_eq!(block_type(&blocks[3]), "bulleted_list_item");
        assert_eq!(block_type(&blocks[4]), "numbered_list_item");
        assert_eq!(plain(&blocks[4]), "first");
    }

    #[test]
    fn converts_empty_html_paragraphs() {
        let blocks = markdown_to_notion_blocks("Hello\n\n<p></p>\n\nThere");
        assert_eq!(blocks.len(), 3);
        assert_eq!(block_type(&blocks[1]), "paragraph");
        assert_eq!(plain(&blocks[1]), "");
    }

    #[test]
    fn empty_markdown_is_one_paragraph() {
        let blocks = markdown_to_notion_blocks("   ");
        assert_eq!(blocks.len(), 1);
        assert_eq!(block_type(&blocks[0]), "paragraph");
    }

    #[test]
    fn converts_quote_code_and_link() {
        let blocks = markdown_to_notion_blocks("> said\n\n```\ncode\n```\n\n[Go](https://example.com)\n");
        assert_eq!(block_type(&blocks[0]), "quote");
        assert_eq!(plain(&blocks[0]), "said");
        assert_eq!(block_type(&blocks[1]), "code");
        assert_eq!(plain(&blocks[1]), "code");
        assert_eq!(
            blocks[2]["paragraph"]["rich_text"][0]["text"]["link"]["url"],
            "https://example.com"
        );
    }

    #[test]
    fn skips_invalid_markdown_link_urls() {
        let blocks = markdown_to_notion_blocks("[Go](asdfasdfasdf)\n");
        let link = &blocks[0]["paragraph"]["rich_text"][0]["text"]["link"];
        assert!(link.is_null());
        assert_eq!(plain(&blocks[0]), "Go");
    }

    #[test]
    fn extracts_text_from_html_paragraph_islands() {
        let blocks = markdown_to_notion_blocks(
            "<p data-harvy-outline-kind=\"instruction\">Write the opening.</p>\n",
        );
        assert_eq!(plain(&blocks[0]), "Write the opening.");
    }

    #[test]
    fn skips_incomplete_http_link_urls() {
        let blocks = markdown_to_notion_blocks("[Go](http://)\n");
        let link = &blocks[0]["paragraph"]["rich_text"][0]["text"]["link"];
        assert!(link.is_null());
        assert_eq!(plain(&blocks[0]), "Go");
    }
}
