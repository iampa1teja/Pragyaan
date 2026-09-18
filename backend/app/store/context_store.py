import re
from pathlib import Path

from ..core.utils import story_dir, ensure_dir
from ..core.constants import CONTEXT_SECTIONS, OUTLINE_START, OUTLINE_END

_OFFSET = 1 + len(CONTEXT_SECTIONS) + 2

_OUTLINE_ENTRY = re.compile(r"-\s*(\w+)\s+L(\d+)-L(\d+)")

def split_sections(markdown: str) -> dict[str, str]:
    sections = {name: "" for name in CONTEXT_SECTIONS}
    current: str | None = None
    buffer: list[str] = []

    def flush():
        if current is not None:
            sections[current] = "\n".join(buffer).strip()

    for line in markdown.split("\n"):
        stripped = line.strip()
        if stripped.startswith("## "):
            heading = stripped[3:].strip()
            if heading in sections:
                flush()
                current = heading
                buffer = []
                continue
        if current is not None:
            buffer.append(line)
    flush()
    return sections


class ContextStore:
    def path(self, story_id: str) -> Path:
        return story_dir(story_id) / "context.md"

    def exists(self, story_id: str) -> bool:
        return self.path(story_id).exists()

    def assemble(self, sections: dict[str, str]) -> str:
        body_lines: list[str] = []
        ranges: dict[str, tuple[int, int]] = {}

        for name in CONTEXT_SECTIONS:
            start = len(body_lines)
            body_lines.append(f"## {name}")
            content = sections.get(name, "").strip()
            if content:
                body_lines.extend(content.split("\n"))
            body_lines.append("")
            end = len(body_lines) - 1
            ranges[name] = (start, end)

        header = [OUTLINE_START]
        for name, (s, e) in ranges.items():
            header.append(f"- {name} L{s + _OFFSET + 1}-L{e + _OFFSET + 1}")
        header.append(OUTLINE_END)
        header.append("")

        return "\n".join(header + body_lines)

    def write(self, story_id: str, sections: dict[str, str]) -> Path:
        ensure_dir(story_dir(story_id))
        path = self.path(story_id)
        path.write_text(self.assemble(sections), encoding="utf-8")
        return path

    def read(self, story_id: str) -> str:
        return self.path(story_id).read_text(encoding="utf-8")

    def read_outline(self, story_id: str) -> dict[str, tuple[int, int]]:
        text = self.read(story_id)
        outline: dict[str, tuple[int, int]] = {}
        inside = False
        for line in text.split("\n"):
            stripped = line.strip()
            if stripped == OUTLINE_START:
                inside = True
                continue
            if stripped == OUTLINE_END:
                break
            if inside:
                m = _OUTLINE_ENTRY.match(stripped)
                if m:
                    outline[m.group(1)] = (int(m.group(2)), int(m.group(3)))
        return outline

    def read_lines(self, story_id: str, start: int, end: int) -> str:
        lines = self.read(story_id).split("\n")
        return "\n".join(lines[start - 1:end])

    def read_section(self, story_id: str, name: str) -> str:
        start, end = self.read_outline(story_id)[name]
        return self.read_lines(story_id, start, end)
