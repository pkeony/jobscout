/**
 * 프로세스 레벨 서킷 브레이커.
 * Gemini가 연속 실패하면 일정 시간 요청 자체를 거부해 사용자 대기시간 단축.
 */

type State = "closed" | "open" | "half-open";

interface BreakerConfig {
  readonly failureThreshold: number;
  readonly cooldownMs: number;
}

const DEFAULT_CONFIG: BreakerConfig = {
  failureThreshold: 3,
  cooldownMs: 60_000,
};

class CircuitBreaker {
  private failures = 0;
  private lastFailureAt = 0;
  private state: State = "closed";

  constructor(private readonly config: BreakerConfig = DEFAULT_CONFIG) {}

  canAttempt(): boolean {
    if (this.state === "closed") return true;
    if (this.state === "open") {
      if (Date.now() - this.lastFailureAt > this.config.cooldownMs) {
        this.state = "half-open";
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureAt = Date.now();
    // half-open 탐색 요청이 실패하면 즉시 open으로 복귀 — 쿨다운 연장.
    // (임계치 초과 판정만 하면 half-open에서 canAttempt가 계속 true를 내주는 레이스 발생)
    if (this.state === "half-open" || this.failures >= this.config.failureThreshold) {
      this.state = "open";
    }
  }

  getRemainingCooldownSec(): number {
    if (this.state !== "open") return 0;
    const elapsed = Date.now() - this.lastFailureAt;
    return Math.max(0, Math.ceil((this.config.cooldownMs - elapsed) / 1000));
  }

  getState(): State {
    return this.state;
  }
}

export class CircuitOpenError extends Error {
  constructor(public readonly remainingSec: number) {
    super(
      `Gemini 서버가 혼잡한 상태입니다. 약 ${remainingSec}초 뒤에 다시 시도해주세요.`,
    );
    this.name = "CircuitOpenError";
  }
}

export const geminiBreaker = new CircuitBreaker();
