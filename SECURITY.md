# 보안 규칙

## API Key 처리

- 사용자의 Gemini API Key는 **클라이언트 localStorage에만 저장**
- 서버로 전송 시 요청 body에 포함, 요청 처리 후 메모리에서 즉시 해제
- API Key를 서버 로그, DB, 파일시스템에 절대 저장하지 않음
- 서버 환경변수에 기본 키를 두지 않음 (사용자 자체 키 전용)

## SSRF 방지 (크롤러)

`src/lib/crawl/crawler.ts`에서 URL 접근 전 차단:

- localhost, 127.0.0.1, [::1], 0.0.0.0
- 10.x.x.x (Class A private)
- 172.16-31.x.x (Class B private)  
- 192.168.x.x (Class C private)
- http/https 외 프로토콜 거부

## 크롤링 안전

- 10초 타임아웃 (DoS 방지)
- 1MB 최대 응답 크기
- HTML Content-Type만 허용
- redirect: follow (오픈 리다이렉트 주의)

## 입력 검증

- 모든 API Route 입력은 Zod 스키마로 검증
- URL: `z.string().url()` — 유효 URL 형식만 허용
- JD 텍스트: 최소 50자 — 의미 없는 입력 거부
