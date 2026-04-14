<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# JobScout — 에이전트 지식맵

> 이 파일은 진입점입니다. 모든 상세를 담지 않고, **어디를 먼저 읽고 무엇을 해야 하는지** 안내합니다.

## 먼저 읽기

| 문서 | 용도 | 언제 읽나 |
|------|------|-----------|
| [CLAUDE.md](CLAUDE.md) | 코딩 규칙, 스택, 금지사항 | **항상** (자동 로드) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 시스템 구조, 데이터 흐름, 디렉토리 맵 | 새 기능 추가 전 |

## 상세 지식

| 폴더 | 내용 | 언제 읽나 |
|------|------|-----------|
| [docs/design-docs/](docs/design-docs/) | 기능별 설계 문서 | 해당 기능 수정 시 |
| [docs/product-specs/](docs/product-specs/) | 수용 기준, 기능 명세 | 기능 구현/검증 시 |
| [docs/references/](docs/references/) | 외부 API 레퍼런스, 크롤링 대상 사이트 정보 | 크롤러/API 작업 시 |
| [docs/exec-plans/](docs/exec-plans/) | 실행 계획 (Phase별 로드맵) | 일정 확인 시 |

## 품질 & 보안

| 문서 | 용도 |
|------|------|
| [QUALITY_SCORE.md](QUALITY_SCORE.md) | 코드 품질 루브릭 |
| [SECURITY.md](SECURITY.md) | 보안 규칙 (API Key 처리, SSRF 방지, 크롤링 안전) |

## 핵심 원칙

1. **루트는 안내판** — AGENTS.md가 모든 지식을 담지 않음. 필요한 위치만 알려줌
2. **기록은 docs/ 하위에** — 설계 문서, 수용 기준, 실행 계획, 참고 자료 분리
3. **필요할 때만 펼쳐 읽기** — 처음부터 모든 문서를 읽지 않음. 필요한 문서만 점진적으로 열어 컨텍스트 예산 절약
