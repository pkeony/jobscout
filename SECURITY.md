# 보안 규칙

## Supabase 인증 (Phase 2A+)

- 쿠키 기반 세션 (`@supabase/ssr`) — 모든 보호 라우트는 middleware 에서 세션 확인
- `SUPABASE_SERVICE_ROLE_KEY` 는 **서버 전용**. `src/lib/supabase/server.ts` 의 `createSupabaseServiceRoleClient()` 만 사용
- service role 키를 import 하는 파일은 `src/lib/supabase/server.ts` / `src/app/api/**/route.ts` / `src/app/api/cron/**/route.ts` 로 제한. 외부 import 발견 시 리뷰 실패
- 모든 사용자 테이블은 `user_id = auth.uid()` RLS 정책 필수. write 는 service role 또는 소유자만
- `consume_credit` / `grant_credits` SP 는 `security definer` + `revoke execute from public, anon, authenticated` — service role 호출 전용

## 토스페이먼츠 결제 (Phase 2C)

- `TOSS_SECRET_KEY` 는 절대 클라이언트 노출 금지. `src/lib/billing/toss/client.ts` 내부에서만 사용 (`Basic base64(SECRET:)` 인코딩)
- `NEXT_PUBLIC_TOSS_CLIENT_KEY` 는 공개 OK — 토스의 client-side SDK 용
- **amount 재검증 필수** — 클라이언트가 보낸 amount 는 서버에서 `PLAN_PRICES` / `TOPUP_PACKS` 와 대조 확인 (변조 방지)
- **customerKey 재검증** — 구독 발급 시 `subscriptions.toss_customer_key` 와 일치 확인
- **orderId 형식 강제** — `topup_${userId}_${packId}_${random}` 으로 시작하는지 검증 → 다른 유저 결제 가로채기 방지
- **멱등성** — `payments.payment_key` PK, `payments.order_id` unique. 중복 콜백 / 중복 크론 실행 시 side-effect 1회만
- **웹훅 서명** — `Toss-Signature` 헤더와 `HMAC-SHA256(body, TOSS_WEBHOOK_SECRET)` 대조 후 수용

## 크레딧 정합성

- `credit_balances.remaining >= 0` DB 레벨 check constraint — 애플리케이션 버그로도 마이너스 불가
- 선차감 + 실패 시 refund (`withCredit.ts`) — 4xx/5xx 응답 또는 throw 시 환불
- SSE 중간 실패는 환불 불가 (헤더 이미 전송) — 허용 가능한 약점. 근거: `src/lib/ai/stream.ts` 폴백/서킷브레이커로 중간 실패율 매우 낮음
- SP `consume_credit` 는 `SELECT ... FOR UPDATE` 로 행 잠금 → 동시 요청 race condition 방지

## SSRF 방지 (크롤러)

`src/lib/crawl/crawler.ts` 에서 URL 접근 전 차단:

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
- 이미지 업로드: MIME whitelist (png/jpeg/webp), 10MB 제한, 파일당 최대 5장

## Cron 엔드포인트

- `/api/cron/*` 모두 `Authorization: Bearer $CRON_SECRET` 검증
- `CRON_SECRET` 누락 시 401 반환 (개발 안전장치)
