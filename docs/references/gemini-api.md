# Gemini API 레퍼런스

## SDK

- 패키지: `@google/generative-ai` v0.24+
- 클라이언트 생성: `new GoogleGenerativeAI(apiKey)`
- 모델: `gemini-2.5-flash`

## 스트리밍

```typescript
const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });
const result = await model.generateContentStream({
  systemInstruction: "...",
  contents: [{ role: "user", parts: [{ text: "..." }] }],
  generationConfig: { maxOutputTokens: 4096, temperature: 0.1 },
});

for await (const chunk of result.stream) {
  chunk.text(); // 텍스트 조각
}

const final = await result.response;
final.usageMetadata; // { promptTokenCount, candidatesTokenCount }
```

## 가격 (gemini-2.5-flash)

- Input: $0.15 / 1M tokens
- Output: $0.60 / 1M tokens

## 주의사항

- `candidatesTokenCount`로 출력 토큰 계산 (totalTokenCount 아님)
- JSON 출력 시 간헐적으로 마크다운 코드블록으로 감싸는 경우 있음 → extractJson()으로 방어
- temperature 0에 가까울수록 분석 안정성 높음
