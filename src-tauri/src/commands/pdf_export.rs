//! Markdown → PDF with simple editorial typography (A4, margins, heading sizes, lists).
//! Built-in Helvetica (Windows-1252); other characters are mapped to ASCII-ish fallbacks.

use printpdf::{
    BuiltinFont, Color, Line, Mm, PdfDocument, PdfDocumentReference, PdfLayerIndex, PdfPageIndex,
    Point, Rgb,
};
use pulldown_cmark::{Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use std::fs::File;
use std::io::BufWriter;

const PAGE_W_MM: f32 = 210.0;
const PAGE_H_MM: f32 = 297.0;
const MARGIN_MM: f32 = 22.0;
const CONTENT_W_MM: f32 = PAGE_W_MM - 2.0 * MARGIN_MM;

fn line_height_mm(font_pt: f32) -> f32 {
    font_pt * 1.42 * 25.4 / 72.0
}

fn chars_per_line(font_pt: f32, indent_mm: f32) -> usize {
    let mm_per_char = font_pt * 0.5 * 25.4 / 72.0;
    let usable = (CONTENT_W_MM - indent_mm).max(40.0);
    ((usable / mm_per_char).floor() as usize).clamp(18, 88)
}

fn wrap_words(text: &str, max_chars: usize) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut lines: Vec<String> = Vec::new();
    let mut cur = String::new();
    for w in words {
        if cur.is_empty() {
            cur.push_str(w);
            continue;
        }
        if cur.len() + 1 + w.len() > max_chars {
            lines.push(std::mem::take(&mut cur));
            cur.push_str(w);
        } else {
            cur.push(' ');
            cur.push_str(w);
        }
    }
    if !cur.is_empty() {
        lines.push(cur);
    }
    if lines.is_empty() {
        lines.push(String::new());
    }
    lines
}

fn sanitize_pdf_text(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '\n' | '\r' => ' ',
            '–' | '—' => '-',
            '…' => '.',
            '\u{2018}' | '\u{2019}' => '\'',
            '\u{201c}' | '\u{201d}' => '"',
            _ if c.is_ascii() => c,
            _ => ' ',
        })
        .collect()
}

fn heading_pt(level: HeadingLevel) -> f32 {
    match level {
        HeadingLevel::H1 => 22.0,
        HeadingLevel::H2 => 17.0,
        HeadingLevel::H3 => 14.0,
        HeadingLevel::H4 | HeadingLevel::H5 | HeadingLevel::H6 => 12.5,
    }
}

struct ListFrame {
    ordered: bool,
    next: u64,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Block {
    Paragraph,
    CodeBlock,
    Item,
}

struct Writer {
    doc: PdfDocumentReference,
    page: PdfPageIndex,
    layer: PdfLayerIndex,
    font: printpdf::IndirectFontRef,
    y: f32,
}

impl Writer {
    fn new(title: &str) -> Result<Self, String> {
        let (doc, page, layer) =
            PdfDocument::new(title, Mm(PAGE_W_MM), Mm(PAGE_H_MM), "Content");
        let font = doc
            .add_builtin_font(BuiltinFont::Helvetica)
            .map_err(|e| e.to_string())?;
        let y = PAGE_H_MM - MARGIN_MM - 6.0;
        Ok(Self {
            doc,
            page,
            layer,
            font,
            y,
        })
    }

    fn fresh_page(&mut self) -> Result<(), String> {
        let (page, layer) = self
            .doc
            .add_page(Mm(PAGE_W_MM), Mm(PAGE_H_MM), "Content");
        self.page = page;
        self.layer = layer;
        self.y = PAGE_H_MM - MARGIN_MM - 6.0;
        Ok(())
    }

    fn ensure_vertical(&mut self, need_mm: f32) -> Result<(), String> {
        if self.y - need_mm < MARGIN_MM + 8.0 {
            self.fresh_page()?;
        }
        Ok(())
    }

    fn space_after_block(&mut self, font_pt: f32) {
        self.y -= line_height_mm(font_pt) * 0.35;
    }

    fn emit_line(&mut self, text: &str, font_pt: f32, indent_mm: f32) -> Result<(), String> {
        let lh = line_height_mm(font_pt);
        self.ensure_vertical(lh)?;
        let layer = self.doc.get_page(self.page).get_layer(self.layer);
        let safe = sanitize_pdf_text(text);
        layer.use_text(safe, font_pt, Mm(MARGIN_MM + indent_mm), Mm(self.y), &self.font);
        self.y -= lh;
        Ok(())
    }

    fn emit_paragraph(&mut self, text: &str, font_pt: f32, indent_mm: f32) -> Result<(), String> {
        let t = text.trim();
        if t.is_empty() {
            self.y -= line_height_mm(font_pt) * 0.55;
            return Ok(());
        }
        let cpl = chars_per_line(font_pt, indent_mm);
        for line in wrap_words(t, cpl) {
            self.emit_line(&line, font_pt, indent_mm)?;
        }
        self.space_after_block(font_pt);
        Ok(())
    }

    fn emit_rule(&mut self) -> Result<(), String> {
        self.ensure_vertical(10.0)?;
        let y_line = self.y - 2.0;
        let layer = self.doc.get_page(self.page).get_layer(self.layer);
        layer.set_outline_color(Color::Rgb(Rgb::new(0.78, 0.78, 0.78, None)));
        layer.set_outline_thickness(0.6);
        let line = Line {
            points: vec![
                (Point::new(Mm(MARGIN_MM), Mm(y_line)), false),
                (Point::new(Mm(PAGE_W_MM - MARGIN_MM), Mm(y_line)), false),
            ],
            is_closed: false,
        };
        layer.add_line(line);
        self.y = y_line - line_height_mm(11.0);
        Ok(())
    }

    fn save(self, path: &str) -> Result<(), String> {
        let file = File::create(path).map_err(|e| e.to_string())?;
        self.doc
            .save(&mut BufWriter::new(file))
            .map_err(|e| e.to_string())
    }
}

pub fn write_markdown_pdf(path: &str, markdown: &str) -> Result<(), String> {
    let title = std::path::Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("Harvy export");
    let mut w = Writer::new(title)?;

    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);

    let mut stack: Vec<Block> = Vec::new();
    let mut list_stack: Vec<ListFrame> = Vec::new();
    let mut blockquote_depth: u32 = 0;
    let mut table_skip: u32 = 0;
    let mut heading_level: Option<HeadingLevel> = None;

    let mut para_buf = String::new();
    let mut heading_buf = String::new();
    let mut code_buf = String::new();
    let mut item_buf = String::new();

    let flush_item = |w: &mut Writer,
                      list_stack: &mut Vec<ListFrame>,
                      bq: u32,
                      buf: &str|
     -> Result<(), String> {
        let depth = list_stack.len().max(1);
        let indent = (depth.saturating_sub(1)) as f32 * 5.0 + bq as f32 * 4.0;
        let prefix = if let Some(frame) = list_stack.last_mut() {
            if frame.ordered {
                let p = format!("{}. ", frame.next);
                frame.next += 1;
                p
            } else {
                "• ".to_string()
            }
        } else {
            "• ".to_string()
        };
        let combined = format!("{}{}", prefix, buf.trim());
        w.emit_paragraph(&combined, 11.0, indent)
    };

    for ev in Parser::new_ext(markdown, options) {
        if table_skip > 0 {
            match &ev {
                Event::Start(Tag::Table(_)) => table_skip += 1,
                Event::End(TagEnd::Table) => table_skip = table_skip.saturating_sub(1),
                _ => {}
            }
            continue;
        }

        match ev {
            Event::Start(Tag::Table(_)) => {
                table_skip = 1;
                continue;
            }
            Event::Start(Tag::Heading { level, .. }) => {
                heading_level = Some(level);
                heading_buf.clear();
            }
            Event::End(TagEnd::Heading(_)) => {
                if let Some(level) = heading_level.take() {
                    let text = std::mem::take(&mut heading_buf);
                    let pt = heading_pt(level);
                    w.emit_paragraph(&text, pt, blockquote_depth as f32 * 4.0)?;
                    w.space_after_block(pt);
                }
            }
            Event::Start(Tag::Paragraph) => {
                stack.push(Block::Paragraph);
                para_buf.clear();
            }
            Event::End(TagEnd::Paragraph) => {
                if matches!(stack.last(), Some(Block::Paragraph)) {
                    stack.pop();
                    let text = std::mem::take(&mut para_buf);
                    if matches!(stack.last(), Some(Block::Item)) {
                        if !item_buf.is_empty() && !text.trim().is_empty() {
                            item_buf.push('\n');
                        }
                        item_buf.push_str(&text);
                    } else {
                        w.emit_paragraph(&text, 11.0, blockquote_depth as f32 * 4.0)?;
                    }
                }
            }
            Event::Start(Tag::CodeBlock(_)) => {
                stack.push(Block::CodeBlock);
                code_buf.clear();
            }
            Event::End(TagEnd::CodeBlock) => {
                if matches!(stack.last(), Some(Block::CodeBlock)) {
                    stack.pop();
                    let body = std::mem::take(&mut code_buf);
                    let indent = blockquote_depth as f32 * 4.0 + 2.0;
                    if body.trim().is_empty() {
                        w.space_after_block(9.5);
                    } else {
                        for line in body.lines() {
                            w.emit_line(line, 9.5, indent)?;
                        }
                        w.space_after_block(9.5);
                    }
                }
            }
            Event::Start(Tag::Item) => {
                stack.push(Block::Item);
                item_buf.clear();
            }
            Event::End(TagEnd::Item) => {
                if matches!(stack.last(), Some(Block::Item)) {
                    stack.pop();
                    let text = std::mem::take(&mut item_buf);
                    flush_item(&mut w, &mut list_stack, blockquote_depth, &text)?;
                }
            }
            Event::Start(Tag::List(start)) => {
                list_stack.push(ListFrame {
                    ordered: start.is_some(),
                    next: start.unwrap_or(1),
                });
            }
            Event::End(TagEnd::List(_)) => {
                list_stack.pop();
                w.space_after_block(11.0);
            }
            Event::Start(Tag::BlockQuote(_)) => {
                blockquote_depth += 1;
            }
            Event::End(TagEnd::BlockQuote(_)) => {
                blockquote_depth = blockquote_depth.saturating_sub(1);
            }
            Event::Rule => {
                w.emit_rule()?;
            }
            Event::Text(t) => {
                let s = t.as_ref();
                if heading_level.is_some() {
                    heading_buf.push_str(s);
                } else if matches!(stack.last(), Some(Block::CodeBlock)) {
                    code_buf.push_str(s);
                } else if matches!(stack.last(), Some(Block::Paragraph)) {
                    para_buf.push_str(s);
                } else if matches!(stack.last(), Some(Block::Item)) {
                    item_buf.push_str(s);
                }
            }
            Event::Code(t) => {
                let s = t.as_ref();
                if heading_level.is_some() {
                    heading_buf.push('`');
                    heading_buf.push_str(s);
                    heading_buf.push('`');
                } else if matches!(stack.last(), Some(Block::CodeBlock)) {
                    code_buf.push_str(s);
                } else if matches!(stack.last(), Some(Block::Paragraph)) {
                    para_buf.push('`');
                    para_buf.push_str(s);
                    para_buf.push('`');
                } else if matches!(stack.last(), Some(Block::Item)) {
                    item_buf.push('`');
                    item_buf.push_str(s);
                    item_buf.push('`');
                }
            }
            Event::SoftBreak => {
                let sp = " ";
                if heading_level.is_some() {
                    heading_buf.push_str(sp);
                } else if matches!(stack.last(), Some(Block::CodeBlock)) {
                    code_buf.push('\n');
                } else if matches!(stack.last(), Some(Block::Paragraph)) {
                    para_buf.push_str(sp);
                } else if matches!(stack.last(), Some(Block::Item)) {
                    item_buf.push_str(sp);
                }
            }
            Event::HardBreak => {
                if heading_level.is_some() {
                    heading_buf.push(' ');
                } else if matches!(stack.last(), Some(Block::CodeBlock)) {
                    code_buf.push('\n');
                } else if matches!(stack.last(), Some(Block::Paragraph)) {
                    para_buf.push('\n');
                } else if matches!(stack.last(), Some(Block::Item)) {
                    item_buf.push('\n');
                }
            }
            Event::TaskListMarker(checked) => {
                let m = if checked { "[x] " } else { "[ ] " };
                if matches!(stack.last(), Some(Block::Paragraph)) {
                    para_buf.push_str(m);
                } else if matches!(stack.last(), Some(Block::Item)) {
                    item_buf.push_str(m);
                }
            }
            _ => {}
        }
    }

    w.save(path)
}
