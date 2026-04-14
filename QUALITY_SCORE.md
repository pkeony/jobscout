# 코드 품질 루브릭

## TypeScript

- [ ] `any` 타입 사용 없음
- [ ] 모든 함수에 명시적 반환 타입 또는 추론 가능
- [ ] Zod 스키마와 TypeScript 타입 일치
- [ ] strict 모드 (`tsc --noEmit` 에러 0)

## API

- [ ] 모든 입력 Zod 검증
- [ ] 에러 응답에 사용자 친화적 한국어 메시지
- [ ] SSE 스트리밍 abort 처리
- [ ] 적절한 HTTP 상태 코드 (400/401/500)

## UI/UX

- [ ] 모든 로딩 상태에 시각적 피드백 (Skeleton, Progress)
- [ ] 에러 상태에 복구 경로 제공 (재시도, fallback 안내)
- [ ] 다크/라이트 모드 정상 작동
- [ ] 모바일 반응형

## 보안

- [ ] API Key 서버 비저장
- [ ] SSRF 방지 (private IP 차단)
- [ ] 크롤러 타임아웃/크기 제한

## 프롬프트

- [ ] JSON 구조화 출력 안정성 (extractJson fallback)
- [ ] 한국어 JD 패턴 인식 (자격요건/우대사항)
- [ ] temperature 적절 (분석: 0.1)
