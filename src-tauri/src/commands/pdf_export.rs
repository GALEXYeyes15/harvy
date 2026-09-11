//! Markdown → PDF with editorial typography (A4, margins, heading sizes, lists).
//! Always embeds Libre Baskerville (Regular + Bold), independent of editor appearance.
//! Other characters are mapped to ASCII-ish fallbacks.
//! Embedded Harvy `<figure data-harvy-image>` blocks (and CommonMark images) are drawn
//! from workspace-relative paths or http(s) URLs when possible.

use image::GenericImageView;
use printpdf::{
    Actions, BorderArray, Color, ColorArray, HighlightingMode, Image, ImageTransform, Line,
    LinkAnnotation, Mm, PdfDocument, PdfDocumentReference, PdfLayerIndex, PdfPageIndex, Point,
    Rect, Rgb,
};
use pulldown_cmark::{Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use regex::Regex;
use std::fs::File;
use std::io::{BufWriter, Cursor};
use std::path::{Path, PathBuf};

const LIBRE_BASKERVILLE_REGULAR: &[u8] =
    include_bytes!("../../fonts/LibreBaskerville-Regular.ttf");
const LIBRE_BASKERVILLE_BOLD: &[u8] = include_bytes!("../../fonts/LibreBaskerville-Bold.ttf");

const PAGE_W_MM: f32 = 210.0;
const PAGE_H_MM: f32 = 297.0;
const MARGIN_MM: f32 = 22.0;
const CONTENT_W_MM: f32 = PAGE_W_MM - 2.0 * MARGIN_MM;
const MAX_IMAGE_H_MM: f32 = 160.0;
const IMAGE_MARKER_PREFIX: &str = "__HARVY_PDF_IMAGE_";

fn line_height_mm(font_pt: f32) -> f32 {
    font_pt * 1.42 * 25.4 / 72.0
}

fn chars_per_line(font_pt: f32, indent_mm: f32) -> usize {
    let mm_per_char = font_pt * 0.5 * 25.4 / 72.0;
    let usable = (CONTENT_W_MM - indent_mm).max(40.0);
    ((usable / mm_per_char).floor() as usize).clamp(18, 88)
}

#[derive(Clone, Debug)]
struct InlineSpan {
    text: String,
    link_url: Option<String>,
}

#[derive(Clone, Debug)]
struct StyledWord {
    word: String,
    link_url: Option<String>,
}

fn push_inline(buf: &mut Vec<InlineSpan>, text: &str, link_url: Option<&str>) {
    if text.is_empty() {
        return;
    }
    if let Some(last) = buf.last_mut() {
        if last.link_url.as_deref() == link_url {
            last.text.push_str(text);
            return;
        }
    }
    buf.push(InlineSpan {
        text: text.to_string(),
        link_url: link_url.map(str::to_string),
    });
}

fn spans_plain_text(spans: &[InlineSpan]) -> String {
    spans.iter().map(|s| s.text.as_str()).collect()
}

fn spans_from_plain(text: &str) -> Vec<InlineSpan> {
    if text.is_empty() {
        return Vec::new();
    }
    vec![InlineSpan {
        text: text.to_string(),
        link_url: None,
    }]
}

fn append_spans(dst: &mut Vec<InlineSpan>, src: Vec<InlineSpan>) {
    for span in src {
        push_inline(dst, &span.text, span.link_url.as_deref());
    }
}

fn styled_words(spans: &[InlineSpan]) -> Vec<StyledWord> {
    let mut out = Vec::new();
    for span in spans {
        let mut cur = String::new();
        for ch in span.text.chars() {
            if ch.is_whitespace() {
                if !cur.is_empty() {
                    out.push(StyledWord {
                        word: std::mem::take(&mut cur),
                        link_url: span.link_url.clone(),
                    });
                }
            } else {
                cur.push(ch);
            }
        }
        if !cur.is_empty() {
            out.push(StyledWord {
                word: cur,
                link_url: span.link_url.clone(),
            });
        }
    }
    out
}

fn wrap_styled_words(words: &[StyledWord], max_chars: usize) -> Vec<Vec<StyledWord>> {
    let mut lines: Vec<Vec<StyledWord>> = Vec::new();
    let mut cur: Vec<StyledWord> = Vec::new();
    let mut cur_len = 0usize;
    for word in words {
        let add = if cur.is_empty() {
            word.word.len()
        } else {
            1 + word.word.len()
        };
        if !cur.is_empty() && cur_len + add > max_chars {
            lines.push(std::mem::take(&mut cur));
            cur.push(word.clone());
            cur_len = word.word.len();
        } else {
            cur_len += add;
            cur.push(word.clone());
        }
    }
    if !cur.is_empty() {
        lines.push(cur);
    }
    if lines.is_empty() {
        lines.push(Vec::new());
    }
    lines
}

fn link_fill() -> Color {
    Color::Rgb(Rgb::new(0.12, 0.35, 0.85, None))
}

fn body_fill() -> Color {
    Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None))
}

fn is_clickable_http_url(url: &str) -> bool {
    let lower = url.trim().to_ascii_lowercase();
    lower.starts_with("http://") || lower.starts_with("https://")
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

fn unescape_html_attr(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn strip_html_tags(value: &str) -> String {
    let re = Regex::new(r"(?is)<[^>]+>").unwrap_or_else(|_| Regex::new("$^").unwrap());
    unescape_html_attr(&re.replace_all(value, "")).trim().to_string()
}

#[derive(Clone)]
struct PdfImageSpec {
    src: String,
    caption: Option<String>,
}

fn image_marker(index: usize) -> String {
    format!("{}{}__", IMAGE_MARKER_PREFIX, index)
}

fn parse_image_marker(text: &str) -> Option<usize> {
    let t = text.trim();
    let rest = t.strip_prefix(IMAGE_MARKER_PREFIX)?;
    let num = rest.strip_suffix("__")?;
    num.parse().ok()
}

/// Lift Harvy figure islands into markers so the Markdown parser keeps document order.
fn extract_harvy_figures(markdown: &str) -> (String, Vec<PdfImageSpec>) {
    let figure_re = match Regex::new(r"(?is)<figure\b[^>]*\bdata-harvy-image\b[^>]*>.*?</figure>") {
        Ok(re) => re,
        Err(_) => return (markdown.to_string(), Vec::new()),
    };
    let src_re = Regex::new(r#"(?is)<img\b[^>]*\bsrc\s*=\s*"([^"]+)""#).ok();
    let caption_re = Regex::new(r"(?is)<figcaption\b[^>]*>(.*?)</figcaption>").ok();
    let data_caption_re = Regex::new(r#"(?is)\bdata-caption\s*=\s*"([^"]*)""#).ok();

    let mut images = Vec::new();
    let mut out = String::with_capacity(markdown.len());
    let mut last = 0usize;

    for mat in figure_re.find_iter(markdown) {
        out.push_str(&markdown[last..mat.start()]);
        let block = mat.as_str();
        let src = src_re
            .as_ref()
            .and_then(|re| re.captures(block))
            .and_then(|c| c.get(1))
            .map(|m| unescape_html_attr(m.as_str().trim()))
            .filter(|s| !s.is_empty());

        if let Some(src) = src {
            let caption = caption_re
                .as_ref()
                .and_then(|re| re.captures(block))
                .and_then(|c| c.get(1))
                .map(|m| strip_html_tags(m.as_str()))
                .filter(|s| !s.is_empty())
                .or_else(|| {
                    data_caption_re
                        .as_ref()
                        .and_then(|re| re.captures(block))
                        .and_then(|c| c.get(1))
                        .map(|m| unescape_html_attr(m.as_str().trim()))
                        .filter(|s| !s.is_empty())
                });
            let idx = images.len();
            images.push(PdfImageSpec { src, caption });
            out.push_str("\n\n");
            out.push_str(&image_marker(idx));
            out.push_str("\n\n");
        }
        // If src is missing, drop the figure silently.
        last = mat.end();
    }
    out.push_str(&markdown[last..]);
    (out, images)
}

fn resolve_image_path(workspace_root: &Path, src: &str) -> Option<PathBuf> {
    let trimmed = src.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return None;
    }
    if trimmed.starts_with("blob:") || trimmed.starts_with("data:") {
        return None;
    }
    let path = PathBuf::from(trimmed);
    if path.is_absolute() {
        return Some(path);
    }
    Some(workspace_root.join(trimmed.trim_start_matches(['/', '\\'])))
}

fn load_image_bytes(workspace_root: &Path, src: &str) -> Option<Vec<u8>> {
    let trimmed = src.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        let response = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(20))
            .build()
            .ok()?
            .get(trimmed)
            .send()
            .ok()?;
        if !response.status().is_success() {
            return None;
        }
        return response.bytes().ok().map(|b| b.to_vec());
    }
    let path = resolve_image_path(workspace_root, trimmed)?;
    std::fs::read(path).ok()
}

fn decode_image(bytes: &[u8]) -> Option<image::DynamicImage> {
    image::load_from_memory(bytes).ok()
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
    font_bold: printpdf::IndirectFontRef,
    y: f32,
    workspace_root: PathBuf,
    images: Vec<PdfImageSpec>,
}

impl Writer {
    fn new(title: &str, workspace_root: &Path, images: Vec<PdfImageSpec>) -> Result<Self, String> {
        let (doc, page, layer) =
            PdfDocument::new(title, Mm(PAGE_W_MM), Mm(PAGE_H_MM), "Content");
        let font = doc
            .add_external_font(Cursor::new(LIBRE_BASKERVILLE_REGULAR))
            .map_err(|e| format!("Could not embed Libre Baskerville for PDF export: {e}"))?;
        let font_bold = doc
            .add_external_font(Cursor::new(LIBRE_BASKERVILLE_BOLD))
            .map_err(|e| format!("Could not embed Libre Baskerville Bold for PDF export: {e}"))?;
        let y = PAGE_H_MM - MARGIN_MM - 6.0;
        Ok(Self {
            doc,
            page,
            layer,
            font,
            font_bold,
            y,
            workspace_root: workspace_root.to_path_buf(),
            images,
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
        self.emit_styled_line(
            &[StyledWord {
                word: text.to_string(),
                link_url: None,
            }],
            font_pt,
            indent_mm,
        )
    }

    fn emit_styled_line(
        &mut self,
        words: &[StyledWord],
        font_pt: f32,
        indent_mm: f32,
    ) -> Result<(), String> {
        self.emit_styled_line_with_font(words, font_pt, indent_mm, false)
    }

    fn emit_styled_line_with_font(
        &mut self,
        words: &[StyledWord],
        font_pt: f32,
        indent_mm: f32,
        bold: bool,
    ) -> Result<(), String> {
        let lh = line_height_mm(font_pt);
        self.ensure_vertical(lh)?;
        if words.is_empty() {
            self.y -= lh;
            return Ok(());
        }

        let mm_per_char = font_pt * 0.5 * 25.4 / 72.0;
        let layer = self.doc.get_page(self.page).get_layer(self.layer);
        let font = if bold { &self.font_bold } else { &self.font };
        let mut x = MARGIN_MM + indent_mm;
        let mut i = 0usize;
        while i < words.len() {
            let url = words[i].link_url.clone();
            let mut run = words[i].word.clone();
            i += 1;
            while i < words.len() && words[i].link_url == url {
                run.push(' ');
                run.push_str(&words[i].word);
                i += 1;
            }
            let safe = sanitize_pdf_text(&run);
            if safe.is_empty() {
                continue;
            }
            let width_mm = safe.chars().count() as f32 * mm_per_char;
            if url.is_some() {
                layer.set_fill_color(link_fill());
            } else {
                layer.set_fill_color(body_fill());
            }
            layer.use_text(safe, font_pt, Mm(x), Mm(self.y), font);
            if let Some(url) = url.as_deref() {
                let underline_y = self.y - font_pt * 0.18 * 25.4 / 72.0;
                layer.set_outline_color(link_fill());
                layer.set_outline_thickness(0.55);
                let line = Line {
                    points: vec![
                        (Point::new(Mm(x), Mm(underline_y)), false),
                        (Point::new(Mm(x + width_mm), Mm(underline_y)), false),
                    ],
                    is_closed: false,
                };
                layer.add_line(line);

                if is_clickable_http_url(url) {
                    let font_mm = font_pt * 25.4 / 72.0;
                    let annot = LinkAnnotation::new(
                        Rect::new(
                            Mm(x),
                            Mm(self.y - font_mm * 0.3),
                            Mm(x + width_mm),
                            Mm(self.y + font_mm * 0.85),
                        ),
                        Some(BorderArray::Solid([0.0, 0.0, 0.0])),
                        Some(ColorArray::Transparent),
                        Actions::uri(url.trim().to_string()),
                        Some(HighlightingMode::Invert),
                    );
                    layer.add_link_annotation(annot);
                }
            }
            x += width_mm;
            if i < words.len() {
                x += mm_per_char; // space between differently styled runs
            }
        }
        layer.set_fill_color(body_fill());
        self.y -= lh;
        Ok(())
    }

    fn emit_paragraph(&mut self, text: &str, font_pt: f32, indent_mm: f32) -> Result<(), String> {
        self.emit_styled_paragraph(&spans_from_plain(text), font_pt, indent_mm)
    }

    fn emit_styled_paragraph(
        &mut self,
        spans: &[InlineSpan],
        font_pt: f32,
        indent_mm: f32,
    ) -> Result<(), String> {
        self.emit_styled_paragraph_with_font(spans, font_pt, indent_mm, false)
    }

    fn emit_styled_paragraph_with_font(
        &mut self,
        spans: &[InlineSpan],
        font_pt: f32,
        indent_mm: f32,
        bold: bool,
    ) -> Result<(), String> {
        let plain = spans_plain_text(spans);
        let t = plain.trim();
        if t.is_empty() {
            self.y -= line_height_mm(font_pt) * 0.55;
            return Ok(());
        }
        if let Some(idx) = parse_image_marker(t) {
            return self.emit_embedded_image(idx, indent_mm);
        }
        let cpl = chars_per_line(font_pt, indent_mm);
        let words = styled_words(spans);
        for line in wrap_styled_words(&words, cpl) {
            self.emit_styled_line_with_font(&line, font_pt, indent_mm, bold)?;
        }
        self.space_after_block(font_pt);
        Ok(())
    }

    fn emit_image_from_src(&mut self, src: &str, caption: Option<&str>, indent_mm: f32) -> Result<(), String> {
        let Some(bytes) = load_image_bytes(&self.workspace_root, src) else {
            return Ok(());
        };
        let Some(dyn_img) = decode_image(&bytes) else {
            return Ok(());
        };

        let (px_w, px_h) = dyn_img.dimensions();
        if px_w == 0 || px_h == 0 {
            return Ok(());
        }

        let usable_w = (CONTENT_W_MM - indent_mm).max(40.0);
        let aspect = px_h as f32 / px_w as f32;
        let mut draw_w = usable_w;
        let mut draw_h = draw_w * aspect;
        if draw_h > MAX_IMAGE_H_MM {
            draw_h = MAX_IMAGE_H_MM;
            draw_w = draw_h / aspect;
        }

        let caption_h = if caption.map(|c| !c.trim().is_empty()).unwrap_or(false) {
            line_height_mm(9.5) * 1.4
        } else {
            0.0
        };
        self.ensure_vertical(draw_h + caption_h + 4.0)?;

        // printpdf treats image size via dpi (1px ≈ 1pt at that dpi). Choose dpi so width matches.
        let dpi = (px_w as f32) * 25.4 / draw_w;
        let translate_x = MARGIN_MM + indent_mm;
        let translate_y = self.y - draw_h;

        let pdf_image = Image::from_dynamic_image(&dyn_img);
        let layer = self.doc.get_page(self.page).get_layer(self.layer);
        pdf_image.add_to_layer(
            layer,
            ImageTransform {
                translate_x: Some(Mm(translate_x)),
                translate_y: Some(Mm(translate_y)),
                dpi: Some(dpi),
                ..Default::default()
            },
        );

        self.y = translate_y - 2.0;
        if let Some(cap) = caption.map(str::trim).filter(|c| !c.is_empty()) {
            self.emit_paragraph(cap, 9.5, indent_mm)?;
        } else {
            self.space_after_block(11.0);
        }
        Ok(())
    }

    fn emit_embedded_image(&mut self, index: usize, indent_mm: f32) -> Result<(), String> {
        let Some(spec) = self.images.get(index).cloned() else {
            return Ok(());
        };
        self.emit_image_from_src(&spec.src, spec.caption.as_deref(), indent_mm)
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

pub fn write_markdown_pdf(path: &str, markdown: &str, workspace_root: &Path) -> Result<(), String> {
    let title = std::path::Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("Harvy export");

    let (prepared, images) = extract_harvy_figures(markdown);
    let mut w = Writer::new(title, workspace_root, images)?;

    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);

    let mut stack: Vec<Block> = Vec::new();
    let mut list_stack: Vec<ListFrame> = Vec::new();
    let mut blockquote_depth: u32 = 0;
    let mut table_skip: u32 = 0;
    let mut heading_level: Option<HeadingLevel> = None;
    let mut image_alt = String::new();
    let mut image_src: Option<String> = None;

    let mut para_buf: Vec<InlineSpan> = Vec::new();
    let mut heading_buf: Vec<InlineSpan> = Vec::new();
    let mut code_buf = String::new();
    let mut item_buf: Vec<InlineSpan> = Vec::new();
    let mut active_link_url: Option<String> = None;

    let flush_item = |w: &mut Writer,
                      list_stack: &mut Vec<ListFrame>,
                      bq: u32,
                      buf: Vec<InlineSpan>|
     -> Result<(), String> {
        let depth = list_stack.len().max(1);
        let indent = (depth.saturating_sub(1)) as f32 * 5.0 + bq as f32 * 4.0;
        let plain = spans_plain_text(&buf);
        if let Some(idx) = parse_image_marker(&plain) {
            return w.emit_embedded_image(idx, indent);
        }
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
        let mut spans = spans_from_plain(&prefix);
        append_spans(&mut spans, buf);
        w.emit_styled_paragraph(&spans, 11.0, indent)
    };

    for ev in Parser::new_ext(&prepared, options) {
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
                    let spans = std::mem::take(&mut heading_buf);
                    let pt = heading_pt(level);
                    w.emit_styled_paragraph_with_font(
                        &spans,
                        pt,
                        blockquote_depth as f32 * 4.0,
                        true,
                    )?;
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
                    let spans = std::mem::take(&mut para_buf);
                    if matches!(stack.last(), Some(Block::Item)) {
                        if !item_buf.is_empty() && !spans_plain_text(&spans).trim().is_empty() {
                            push_inline(&mut item_buf, "\n", None);
                        }
                        append_spans(&mut item_buf, spans);
                    } else {
                        w.emit_styled_paragraph(&spans, 11.0, blockquote_depth as f32 * 4.0)?;
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
                    let spans = std::mem::take(&mut item_buf);
                    flush_item(&mut w, &mut list_stack, blockquote_depth, spans)?;
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
            Event::Start(Tag::Link { dest_url, .. }) => {
                active_link_url = Some(dest_url.into_string());
            }
            Event::End(TagEnd::Link) => {
                active_link_url = None;
            }
            Event::Start(Tag::Image { dest_url, .. }) => {
                image_src = Some(dest_url.into_string());
                image_alt.clear();
            }
            Event::End(TagEnd::Image) => {
                if let Some(src) = image_src.take() {
                    let alt = std::mem::take(&mut image_alt);
                    let caption = if alt.trim().is_empty() {
                        None
                    } else {
                        Some(alt)
                    };
                    w.emit_image_from_src(
                        &src,
                        caption.as_deref(),
                        blockquote_depth as f32 * 4.0,
                    )?;
                }
            }
            Event::Rule => {
                w.emit_rule()?;
            }
            Event::Text(t) => {
                let s = t.as_ref();
                let link = active_link_url.as_deref();
                if image_src.is_some() {
                    image_alt.push_str(s);
                } else if heading_level.is_some() {
                    push_inline(&mut heading_buf, s, link);
                } else if matches!(stack.last(), Some(Block::CodeBlock)) {
                    code_buf.push_str(s);
                } else if matches!(stack.last(), Some(Block::Paragraph)) {
                    push_inline(&mut para_buf, s, link);
                } else if matches!(stack.last(), Some(Block::Item)) {
                    push_inline(&mut item_buf, s, link);
                }
            }
            Event::Code(t) => {
                let s = t.as_ref();
                let link = active_link_url.as_deref();
                let code = format!("`{}`", s);
                if heading_level.is_some() {
                    push_inline(&mut heading_buf, &code, link);
                } else if matches!(stack.last(), Some(Block::CodeBlock)) {
                    code_buf.push_str(s);
                } else if matches!(stack.last(), Some(Block::Paragraph)) {
                    push_inline(&mut para_buf, &code, link);
                } else if matches!(stack.last(), Some(Block::Item)) {
                    push_inline(&mut item_buf, &code, link);
                }
            }
            Event::SoftBreak => {
                let sp = " ";
                let link = active_link_url.as_deref();
                if image_src.is_some() {
                    image_alt.push_str(sp);
                } else if heading_level.is_some() {
                    push_inline(&mut heading_buf, sp, link);
                } else if matches!(stack.last(), Some(Block::CodeBlock)) {
                    code_buf.push('\n');
                } else if matches!(stack.last(), Some(Block::Paragraph)) {
                    push_inline(&mut para_buf, sp, link);
                } else if matches!(stack.last(), Some(Block::Item)) {
                    push_inline(&mut item_buf, sp, link);
                }
            }
            Event::HardBreak => {
                let link = active_link_url.as_deref();
                if image_src.is_some() {
                    image_alt.push(' ');
                } else if heading_level.is_some() {
                    push_inline(&mut heading_buf, " ", link);
                } else if matches!(stack.last(), Some(Block::CodeBlock)) {
                    code_buf.push('\n');
                } else if matches!(stack.last(), Some(Block::Paragraph)) {
                    push_inline(&mut para_buf, "\n", link);
                } else if matches!(stack.last(), Some(Block::Item)) {
                    push_inline(&mut item_buf, "\n", link);
                }
            }
            Event::TaskListMarker(checked) => {
                let m = if checked { "[x] " } else { "[ ] " };
                if matches!(stack.last(), Some(Block::Paragraph)) {
                    push_inline(&mut para_buf, m, None);
                } else if matches!(stack.last(), Some(Block::Item)) {
                    push_inline(&mut item_buf, m, None);
                }
            }
            _ => {}
        }
    }

    w.save(path)
}

#[cfg(test)]
mod tests {
    use super::write_markdown_pdf;
    use std::env;

    #[test]
    fn pdf_export_embeds_libre_baskerville() {
        let dir = env::temp_dir();
        let path = dir.join("harvy-baskerville-export-test.pdf");
        write_markdown_pdf(
            path.to_str().expect("utf8 path"),
            "# Title\n\nHello world.\n",
            &dir,
        )
        .expect("write pdf");
        let bytes = std::fs::read(&path).expect("read pdf");
        let _ = std::fs::remove_file(&path);
        let has = |needle: &[u8]| {
            bytes
                .windows(needle.len())
                .any(|window| window.eq_ignore_ascii_case(needle))
        };
        assert!(has(b"Baskerville"), "expected embedded Baskerville in PDF");
        assert!(!has(b"/Helvetica"), "PDF export should not use Helvetica");
    }
}
